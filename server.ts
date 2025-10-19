import 'dotenv/config';
import { WebSocketServer } from 'ws';
import {
  Agent,
  handoff,
  tool,
  Runner,
  RunState,
  type RunToolApprovalItem,
} from '@openai/agents';
import z from 'zod';
import { aisdk } from '@openai/agents-extensions';
import { openai } from '@ai-sdk/openai';

const model = aisdk(openai('gpt-4o-mini'));

// ----- Tools -----
const getWeatherTool = tool({
  name: 'get-weather',
  description: 'Get weather information for a location',
  execute: async ({ location }) => ({
    location,
    temperature: 72,
    condition: 'Sunny',
    humidity: 45,
    windSpeed: 10,
  }),
  parameters: z.object({
    location: z.string(),
  }),
});

const sendMailTool = tool({
  name: 'send-mail',
  description: 'Send an email',
  execute: async ({ to, subject, body }) => ({
    message: `Email sent to ${to} with subject: ${subject}`,
    body,
  }),
  parameters: z.object({
    to: z.string(),
    subject: z.string(),
    body: z.string(),
  }),
  needsApproval: true,
});

const getMailsTool = tool({
  name: 'get-mails',
  description: 'Get emails from inbox',
  execute: async () => ({
    emails: [
      {
        id: '1',
        from: 'client@example.com',
        subject: 'Urgent: Project deadline approaching',
        body: 'Hi, we need to discuss the upcoming deadline for the Q4 project. Can we schedule a call?',
        timestamp: '2025-10-19T09:30:00Z',
      },
      {
        id: '2',
        from: 'team@company.com',
        subject: 'Meeting reschedule request',
        body: 'The team meeting scheduled for tomorrow needs to be rescheduled. Please confirm your availability for next week.',
        timestamp: '2025-10-19T10:15:00Z',
      },
      {
        id: '3',
        from: 'support@service.com',
        subject: 'Action required: Account verification',
        body: 'Please verify your account details to continue using our services. Click the link to complete verification.',
        timestamp: '2025-10-19T11:00:00Z',
      },
    ],
  }),
  parameters: z.object({}),
});

// ----- Agents -----
const generalAgent = new Agent({
  name: 'general-agent',
  instructions: 'Handle general requests like weather information',
  tools: [getWeatherTool],
  model,
});

const mailAgent = new Agent({
  name: 'mail-agent',
  instructions: 'Manage emails - read inbox and send emails',
  tools: [getMailsTool, sendMailTool],
  model,
});

generalAgent.handoffs.push(handoff(mailAgent));

// ----- WS + Sessions -----
type Session = {
  ws: any;
  closed: boolean;
  conversationId: string;
  runner: Runner;
  agent: Agent;
  maxTurns: number;
  stateString?: string;
  lastHistory: any[];
  runId: number;
};
const sessions = new Map<any, Session>();

const wss = new WebSocketServer({ port: 8787 });
console.log('ws://localhost:8787');

wss.on('connection', (ws) => {
  ws.on('close', () => {
    const s = sessions.get(ws);
    if (s) s.closed = true;
  });

  ws.on('message', async (raw) => {
    let data: any;
    try {
      data = JSON.parse(String(raw));
    } catch {
      safeSend(ws, { error: 'invalid_json' });
      return;
    }

    if (data?.kind === 'message') {
      const text = typeof data.message === 'string' ? data.message.trim() : '';
      if (!text) {
        safeSend(ws, { error: 'empty_message' });
        return;
      }

      let session = sessions.get(ws);

      if (!data.conversationId) {
        const conversationId = genId();

        safeSend(ws, {
          type: 'streaming',
          data: { conversationId },
        });

        const runner = new Runner({
          groupId: conversationId,
          modelSettings: { parallelToolCalls: false },
        });

        session = {
          ws,
          closed: false,
          conversationId,
          runner,
          agent: generalAgent,
          maxTurns: typeof data.maxTurns === 'number' ? data.maxTurns : 10,
          stateString: undefined,
          lastHistory: [],
          runId: 0,
        };
        sessions.set(ws, session);

        startRun(session, [{ role: 'user', content: text }]).catch((err) => {
          safeSend(ws, { error: String(err?.message ?? err) });
        });
        return;
      }

      if (!session) {
        safeSend(ws, { error: 'session_not_found' });
        return;
      }

      if (session.stateString) {
        safeSend(ws, { error: 'pending_approvals' });
        return;
      }

      const messages = session.lastHistory.length
        ? [...session.lastHistory, { role: 'user', content: text }]
        : [{ role: 'user', content: text }];

      startRun(session, messages).catch((err) => {
        safeSend(ws, { error: String(err?.message ?? err) });
      });
      return;
    }

    if (data?.kind === 'approvals' && Array.isArray(data.decisions)) {
      const s = sessions.get(ws);
      if (!s) {
        safeSend(ws, { error: 'session_not_found' });
        return;
      }
      if (!s.stateString) {
        safeSend(ws, { error: 'no_pending_approvals' });
        return;
      }

      const state = await RunState.fromString(s.agent, s.stateString);
      const decisionsMap = new Map<string, 'approved' | 'rejected'>();
      for (const d of data.decisions) {
        const callId = d?.callId;
        const decision = d?.decision;
        if (
          typeof callId === 'string' &&
          (decision === 'approved' || decision === 'rejected')
        ) {
          decisionsMap.set(callId, decision);
        }
      }

      const interruptions = state.getInterruptions();
      for (const item of interruptions) {
        const appr = item as RunToolApprovalItem;
        if (appr.type === 'tool_approval_item' && 'callId' in appr.rawItem) {
          const cid = appr.rawItem.callId as string;
          const dec = decisionsMap.get(cid);
          if (dec === 'approved') state.approve(appr);
          else if (dec === 'rejected') state.reject(appr);
        }
      }

      startRun(s, state).catch((err) => {
        safeSend(ws, { error: String(err?.message ?? err) });
      });
      return;
    }
  });
});

// ----- Helpers -----
function safeSend(ws: any, obj: any) {
  try {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
  } catch {}
}
function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function startRun(session: Session, input: any[] | RunState<any, any>) {
  if (session.closed) return;
  const myRunId = ++session.runId;

  const stream = await session.runner.run(session.agent, input, {
    stream: true,
    maxTurns: session.maxTurns,
  });

  for await (const ev of stream.toStream()) {
    if (session.closed) break;
    if (myRunId !== session.runId) break;
    if (session.ws.readyState !== session.ws.OPEN) break;
    session.ws.send(JSON.stringify(ev));
  }

  await stream.completed;
  if (session.closed || myRunId !== session.runId) return;

  session.lastHistory = stream.history ?? session.lastHistory;

  if (stream.interruptions && stream.interruptions.length > 0) {
    session.stateString = JSON.stringify(stream.state);
    return;
  }

  session.stateString = undefined;
  safeSend(session.ws, {
    type: 'complete',
    data: {
      conversationId: session.conversationId,
      history: stream.history,
      response: stream.finalOutput,
    },
  });
}
