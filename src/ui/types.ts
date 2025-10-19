// ui/types.ts
export type UIMessage = {
  id: string;
  agent?: string;
  role: 'assistant' | 'user' | 'system';
  text?: string;
  images?: string[];
  done?: boolean;
};

export type UIToolCall = {
  id: string;
  agent?: string;
  name: string;
  arguments: string;
  status: 'in_progress' | 'completed' | 'incomplete';
  output?: string;
};

export type UIHandoff = {
  id: string;
  sourceAgent: string;
  targetAgent: string;
  payloadSummary?: string;
};

export type UIReasoningChunk = {
  id: string;
  agent?: string;
  text: string;
};

export type UIApprovalRequest = {
  id: string;
  agent?: string;
  toolName: string;
  arguments: string;
  raw?: any;
};

export type UITimelineItem =
  | {
      kind: 'message';
      id: string;
      seq: number;
      agent?: string;
      role: 'assistant' | 'user' | 'system';
      text: string;
      done?: boolean;
      images?: string[];
    }
  | {
      kind: 'tool_call';
      id: string;
      seq: number;
      agent?: string;
      name: string;
      arguments: string;
      status: 'in_progress' | 'completed' | 'incomplete';
    }
  | {
      kind: 'tool_output';
      id: string;
      seq: number;
      agent?: string;
      name?: string;
      output: string;
    }
  | {
      kind: 'approval';
      id: string;
      seq: number;
      agent?: string;
      toolName: string;
      arguments: string;
    }
  | {
      kind: 'handoff';
      id: string;
      seq: number;
      sourceAgent: string;
      targetAgent: string;
      summary?: string;
    }
  | {
      kind: 'reasoning';
      id: string;
      seq: number;
      agent?: string;
      text: string;
    };

export type UIRunState = {
  currentAgent?: string;
  conversationId?: string;
  messages: UIMessage[];
  toolCalls: Record<string, UIToolCall>;
  handoffs: UIHandoff[];
  reasoning: UIReasoningChunk[];
  approvals: UIApprovalRequest[];
  raw: any[];
  timeline: UITimelineItem[];
  _meta: { seq: number; liveMessageId?: string; usingDeltas?: boolean };
};
