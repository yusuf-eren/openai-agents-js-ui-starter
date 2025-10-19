import type { UIRunState, UITimelineItem } from './types';

export const initialRunState: UIRunState = {
  messages: [],
  toolCalls: {},
  handoffs: [],
  reasoning: [],
  approvals: [],
  raw: [],
  timeline: [],
  _meta: { seq: 0, liveMessageId: undefined, usingDeltas: false },
};

export function reduceEvent(state: UIRunState, incoming: any): UIRunState {
  if (!incoming || typeof incoming !== 'object') return state;

  let s: UIRunState = { ...state, raw: [...state.raw, incoming] };

  if (incoming.type === 'local_user_message') {
    const id = makeId();
    const text = incoming.text ?? '';
    const msg = {
      id,
      role: 'user' as const,
      text,
      done: true,
    };
    s = { ...s, messages: [...s.messages, msg] };
    s = upsertTimelineMessage(s, {
      id,
      role: 'user',
      addText: text,
      images: [],
      doneFlag: true,
    });
    return s;
  }

  if (incoming.type === 'streaming' && incoming.data?.conversationId) {
    // yeni run başlıyor. canlı mesaj id'sini sıfırla
    return {
      ...s,
      conversationId: incoming.data.conversationId,
      _meta: { ...s._meta, liveMessageId: undefined, usingDeltas: false },
    };
  }

  if (incoming.type === 'complete') {
    // run bitti. canlı bayrakları temizle (seq'i bozma)
    return {
      ...s,
      _meta: { ...s._meta, liveMessageId: undefined, usingDeltas: false },
    };
  }

  if (incoming.type === 'agent_updated_stream_event' && incoming.agent?.name) {
    return { ...s, currentAgent: incoming.agent.name };
  }

  if (incoming.type === 'raw_model_stream_event') {
    return handleRawModel(s, incoming.data);
  }

  if (incoming.type === 'run_item_stream_event') {
    const item = incoming.item;
    switch (item?.type) {
      case 'message_output_item': {
        const id = item.rawItem?.id ?? s._meta.liveMessageId ?? makeId();
        const role = item.rawItem?.role ?? 'assistant';
        const agent = item.agent?.name;
        const parts = Array.isArray(item.rawItem?.content)
          ? item.rawItem.content
          : [];
        const incImages = parts
          .filter(
            (p: any) => p?.type === 'image' && typeof p.image === 'string',
          )
          .map((p: any) => p.image);
        const done = item.rawItem?.status === 'completed';

        // messages bölümü
        const prev = s.messages.find((m) => m.id === id);
        const mergedMsg = {
          id,
          agent,
          role,
          text: prev?.text ?? '', // text deltalardan akıyor
          images: [...(prev?.images ?? []), ...incImages],
          done,
        };
        s = { ...s, messages: upsertById(s.messages, mergedMsg) };

        // timeline: var olan mesaj kartını güncelle
        s = upsertTimelineMessage(s, {
          id,
          agent,
          role,
          addText: '',
          images: incImages,
          doneFlag: done,
        });
        s._meta.liveMessageId = id;
        return s;
      }

      case 'tool_call_item': {
        const rc = item.rawItem ?? {};
        const id = rc.callId ?? rc.id ?? makeId();
        const agent = item.agent?.name;
        const toolName = rc.name ?? 'unknown_tool';
        const args = asString(rc.arguments);
        const status = rc.status ?? 'in_progress';

        s = {
          ...s,
          toolCalls: {
            ...s.toolCalls,
            [id]: { id, agent, name: toolName, arguments: args, status },
          },
        };
        s = upsertTimelineToolCall(s, {
          id,
          agent,
          name: toolName,
          arguments: args,
          status,
        });
        return s;
      }

      case 'tool_call_output_item': {
        const rc = item.rawItem ?? {};
        const id = rc.callId ?? rc.id ?? makeId();
        const prev = s.toolCalls[id] ?? {
          id,
          agent: item.agent?.name,
          name: 'unknown_tool',
          arguments: '',
          status: 'in_progress',
        };
        const updated = {
          ...prev,
          output: asString(item.output),
          status: rc.status ?? 'completed',
        };
        s = { ...s, toolCalls: { ...s.toolCalls, [id]: updated } };
        s = appendTimelineToolOutput(s, {
          callId: id,
          agent: updated.agent,
          name: updated.name,
          output: updated.output ?? '',
        });
        return s;
      }

      case 'tool_approval_item': {
        const rc = item.rawItem ?? {};
        const id = rc.callId ?? rc.id ?? makeId();
        const agent = item.agent?.name;
        const toolName = rc.name ?? 'unknown_tool';
        const args = asString(rc.arguments);
        if (!s.approvals.some((a) => a.id === id)) {
          s = {
            ...s,
            approvals: [
              ...s.approvals,
              {
                id,
                agent,
                toolName,
                arguments: args,
                raw: item.toJSON?.() ?? item,
              },
            ],
          };
          s = appendTimeline(s, {
            kind: 'approval',
            id,
            seq: nextSeq(s),
            agent,
            toolName,
            arguments: args,
          });
        }
        return s;
      }

      case 'reasoning_item': {
        const id = item.rawItem?.id ?? makeId();
        const agent = item.agent?.name;
        const text = [
          ...(item.rawItem?.rawContent ?? []),
          ...(item.rawItem?.content ?? []),
        ]
          .map((p: any) => p?.text)
          .filter(Boolean)
          .join('\n');
        s = { ...s, reasoning: [...s.reasoning, { id, agent, text }] };
        s = appendTimeline(s, {
          kind: 'reasoning',
          id: `reason:${id}:${s._meta.seq + 1}`,
          seq: nextSeq(s),
          agent,
          text,
        });
        return s;
      }

      case 'handoff_output_item': {
        const rc = item.rawItem ?? {};
        const id = rc.callId ?? rc.id ?? makeId();
        const sourceAgent =
          item.sourceAgent?.name ?? item.agent?.name ?? 'unknown';
        const targetAgent = item.targetAgent?.name ?? 'unknown';
        const summary = summarize(rc.output);
        s = {
          ...s,
          handoffs: [
            ...s.handoffs,
            { id, sourceAgent, targetAgent, payloadSummary: summary },
          ],
        };
        s = appendTimeline(s, {
          kind: 'handoff',
          id: `handoff:${id}`,
          seq: nextSeq(s),
          sourceAgent,
          targetAgent,
          summary,
        });
        return s;
      }

      default:
        return s;
    }
  }

  return s;
}

// raw model tarafı: delta ve erken tool sinyalleri
function handleRawModel(state: UIRunState, data: any): UIRunState {
  let s = state;

  const delta = extractTextDelta(data);
  if (delta) {
    const id = s._meta.liveMessageId ?? makeId();
    // messages
    const prev = s.messages.find((m) => m.id === id);
    const agent = prev?.agent;
    const merged = {
      id,
      agent,
      role: 'assistant' as const,
      text: (prev?.text ?? '') + delta,
      images: prev?.images ?? [],
      done: false,
    };
    s = { ...s, messages: upsertById(s.messages, merged) };
    // timeline mesajını güncelle ya da oluştur
    s = upsertTimelineMessage(s, {
      id,
      agent,
      role: 'assistant',
      addText: delta,
    });
    s._meta.liveMessageId = id;
    s._meta.usingDeltas = true;
    return s;
  }

  if (isTextDone(data)) {
    if (s._meta.liveMessageId) {
      const prev = s.messages.find((m) => m.id === s._meta.liveMessageId);
      if (prev) {
        s = { ...s, messages: upsertById(s.messages, { ...prev, done: true }) };
        s = upsertTimelineMessage(s, {
          id: s._meta.liveMessageId,
          doneFlag: true,
        });
      }
    }
    return s;
  }

  const toolSig = extractToolSignal(data);
  if (toolSig) {
    const { callId, name, args } = toolSig;
    const prev = s.toolCalls[callId];
    const agent = prev?.agent;
    const merged = {
      id: callId,
      agent,
      name,
      arguments: asString(args ?? prev?.arguments ?? ''),
      status: prev?.status ?? 'in_progress',
      output: prev?.output,
    };
    s = { ...s, toolCalls: { ...s.toolCalls, [callId]: merged } };
    s = upsertTimelineToolCall(s, merged);
    return s;
  }

  return s;
}

// timeline yardımcıları
function upsertTimelineMessage(
  s: UIRunState,
  opts: {
    id: string;
    agent?: string;
    role?: 'assistant' | 'user' | 'system';
    addText?: string;
    images?: string[];
    doneFlag?: boolean;
  },
): UIRunState {
  const i = findLastIndex(
    s.timeline,
    (it) => it.kind === 'message' && it.id === opts.id,
  );
  if (i >= 0) {
    const cur = s.timeline[i] as Extract<UITimelineItem, { kind: 'message' }>;
    const updated: UITimelineItem = {
      ...cur,
      text: (cur.text ?? '') + (opts.addText ?? ''),
      images: [...(cur.images ?? []), ...(opts.images ?? [])],
      done: opts.doneFlag ?? cur.done,
    };
    const copy = s.timeline.slice();
    copy[i] = updated;
    return { ...s, timeline: copy };
  }
  const item: UITimelineItem = {
    kind: 'message',
    id: opts.id,
    seq: nextSeq(s),
    agent: opts.agent,
    role: opts.role ?? 'assistant',
    text: opts.addText ?? '',
    images: opts.images ?? [],
    done: !!opts.doneFlag,
  };
  return appendTimeline(s, item);
}

function upsertTimelineToolCall(
  s: UIRunState,
  t: {
    id: string;
    agent?: string;
    name: string;
    arguments: string;
    status: 'in_progress' | 'completed' | 'incomplete';
  },
): UIRunState {
  const i = findLastIndex(
    s.timeline,
    (it) => it.kind === 'tool_call' && it.id === t.id,
  );
  if (i >= 0) {
    const cur = s.timeline[i] as Extract<UITimelineItem, { kind: 'tool_call' }>;
    const updated: UITimelineItem = {
      ...cur,
      agent: t.agent ?? cur.agent,
      name: t.name,
      arguments: t.arguments,
      status: t.status,
    };
    const copy = s.timeline.slice();
    copy[i] = updated;
    return { ...s, timeline: copy };
  }
  const item: UITimelineItem = {
    kind: 'tool_call',
    id: t.id,
    seq: nextSeq(s),
    agent: t.agent,
    name: t.name,
    arguments: t.arguments,
    status: t.status,
  };
  return appendTimeline(s, item);
}

function appendTimelineToolOutput(
  s: UIRunState,
  t: { callId: string; agent?: string; name?: string; output: string },
): UIRunState {
  const item: UITimelineItem = {
    kind: 'tool_output',
    id: `toolout:${t.callId}:${s._meta.seq + 1}`,
    seq: nextSeq(s),
    agent: t.agent,
    name: t.name,
    output: t.output,
  };
  return appendTimeline(s, item);
}

function appendTimeline(s: UIRunState, it: UITimelineItem): UIRunState {
  return { ...s, timeline: [...s.timeline, it] };
}

function nextSeq(s: UIRunState): number {
  s._meta.seq += 1;
  return s._meta.seq;
}

// yardımcılar
function extractTextDelta(data: any): string | null {
  if (data?.type === 'output_text_delta' && typeof data.delta === 'string')
    return data.delta;
  if (
    data?.type === 'response.output_text.delta' &&
    typeof data.delta === 'string'
  )
    return data.delta;
  if (
    data?.event?.type === 'response.output_text.delta' &&
    typeof data.event.delta === 'string'
  )
    return data.event.delta;
  if (data?.event?.object === 'chat.completion.chunk') {
    const c = data.event.choices?.[0];
    const t = c?.delta?.content;
    if (typeof t === 'string' && t.length) return t;
  }
  return null;
}
function isTextDone(data: any): boolean {
  if (
    data?.type === 'output_text_done' ||
    data?.type === 'response.output_text.done'
  )
    return true;
  if (data?.type === 'response.completed') return true;
  if (
    data?.event?.type === 'response.output_text.done' ||
    data?.event?.type === 'response.completed'
  )
    return true;
  return false;
}
function extractToolSignal(
  data: any,
): { callId: string; name: string; args?: any } | null {
  const ev = data?.event;
  if (ev && ev.type === 'tool-call') {
    const callId = ev.toolCallId ?? ev.callId;
    const name = ev.toolName ?? ev.name;
    if (typeof callId === 'string' && typeof name === 'string') {
      let args: any = ev.input;
      if (typeof args === 'string') {
        try {
          args = JSON.parse(args);
        } catch {}
      }
      return { callId, name, args };
    }
  }
  return null;
}
function upsertById<T extends { id: string }>(arr: T[], obj: T): T[] {
  const i = arr.findIndex((x) => x.id === obj.id);
  if (i === -1) return [...arr, obj];
  const copy = arr.slice();
  copy[i] = obj;
  return copy;
}
function findLastIndex<T>(arr: T[], pred: (v: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) if (pred(arr[i])) return i;
  return -1;
}
function asString(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}
function summarize(v: unknown): string {
  const s = asString(v);
  return s.length > 200 ? s.slice(0, 200) + '…' : s;
}
function makeId() {
  return Math.random().toString(36).slice(2);
}
