import React, { useEffect, useRef } from 'react';
import type { UIRunState, UITimelineItem } from './types';
import { isHandoffToolName } from './handy';

function isToolCall(
  it: UITimelineItem,
): it is Extract<UITimelineItem, { kind: 'tool_call' }> {
  return it.kind === 'tool_call';
}
function isToolOutput(
  it: UITimelineItem,
): it is Extract<UITimelineItem, { kind: 'tool_output' }> {
  return it.kind === 'tool_output';
}

export function Timeline({
  state,
  hideHandoffToolCalls = false,
}: {
  state: UIRunState;
  hideHandoffToolCalls?: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  
  let items = state.timeline.slice().sort((a, b) => a.seq - b.seq);
  if (hideHandoffToolCalls) {
    items = items.filter((it) => {
      if (isToolCall(it) && isHandoffToolName(it.name)) return false;
      if (isToolOutput(it) && isHandoffToolName(it.name)) return false;
      return true;
    });
  }

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [items.length]);

  return (
    <div className="space-y-3">
      {items.map((it) => {
        switch (it.kind) {
          case 'message':
            const isUser = it.role === 'user';
            return (
              <div
                key={`${it.kind}-${it.id}-${it.seq}`}
                className={`border rounded-lg p-3 ${
                  isUser
                    ? 'bg-blue-50 border-blue-200 ml-8'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="text-xs opacity-60">
                  {isUser ? '👤 You' : `🤖 ${it.agent ?? 'agent'}`} · {it.role}{' '}
                  {it.done ? '· done' : ''}
                </div>
                {it.text && (
                  <div className="whitespace-pre-wrap mt-1 text-slate-700">
                    {it.text}
                  </div>
                )}
                {!!it.images?.length && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {it.images.map((src, i) => (
                      <img
                        key={i}
                        src={src}
                        alt=""
                        className="h-16 w-16 object-cover rounded border"
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          case 'tool_call':
            return (
              <div
                key={`${it.kind}-${it.id}-${it.seq}`}
                className="border border-purple-200 rounded-lg p-3 bg-purple-50"
              >
                <div className="flex items-center gap-2 text-xs text-slate-600 mb-2">
                  <span className="font-medium">🔧 {it.agent ?? 'agent'}</span>
                  <span>·</span>
                  <span>tool call</span>
                  <span>·</span>
                  <span className={`capitalize font-medium px-2 py-0.5 rounded text-xs ${
                    it.status === 'completed' ? 'bg-green-100 text-green-700' : 
                    it.status === 'incomplete' ? 'bg-red-100 text-red-700' : 
                    'bg-amber-100 text-amber-700'
                  }`}>{it.status}</span>
                </div>
                <div className="text-sm font-semibold text-purple-900 mb-2">{it.name}</div>
                <details className="text-xs">
                  <summary className="cursor-pointer text-slate-600 hover:text-purple-700 font-medium">
                    View Arguments
                  </summary>
                  <pre className="mt-2 bg-white p-2 rounded border border-purple-200 overflow-auto text-slate-700">
                    {it.arguments}
                  </pre>
                </details>
              </div>
            );
          case 'tool_output':
            return (
              <div
                key={`${it.kind}-${it.id}-${it.seq}`}
                className="border border-green-200 rounded-lg p-3 bg-green-50"
              >
                <div className="flex items-center gap-2 text-xs text-slate-600 mb-2">
                  <span className="font-medium">✓ {it.agent ?? 'agent'}</span>
                  <span>·</span>
                  <span>tool output</span>
                  {it.name && (
                    <>
                      <span>·</span>
                      <span className="font-mono text-green-700">{it.name}</span>
                    </>
                  )}
                </div>
                <details className="text-xs" open>
                  <summary className="cursor-pointer text-slate-600 hover:text-green-700 font-medium mb-2">
                    Output
                  </summary>
                  <pre className="mt-1 bg-white p-2 rounded border border-green-200 overflow-auto text-slate-700 max-h-60">
                    {it.output}
                  </pre>
                </details>
              </div>
            );
          case 'approval':
            return (
              <div
                key={`${it.kind}-${it.id}-${it.seq}`}
                className="border border-amber-300 rounded-lg p-3 bg-amber-50"
              >
                <div className="flex items-center gap-2 text-xs text-slate-600 mb-2">
                  <span className="text-lg">⚠️</span>
                  <span className="font-medium">{it.agent ?? 'agent'}</span>
                  <span>·</span>
                  <span className="font-semibold text-amber-700">Approval Required</span>
                </div>
                <div className="text-sm font-semibold text-amber-900 mb-2">{it.toolName}</div>
                <details className="text-xs">
                  <summary className="cursor-pointer text-slate-600 hover:text-amber-700 font-medium">
                    View Details
                  </summary>
                  <pre className="mt-2 bg-white p-2 rounded border border-amber-200 overflow-auto text-slate-700">
                    {it.arguments}
                  </pre>
                </details>
              </div>
            );
          case 'handoff':
            return (
              <div
                key={`${it.kind}-${it.id}-${it.seq}`}
                className="border border-indigo-200 rounded-lg p-3 bg-indigo-50"
              >
                <div className="text-xs text-slate-600 mb-2 font-medium">
                  🔄 Agent Handoff
                </div>
                <div className="flex items-center gap-2 text-sm font-semibold text-indigo-900">
                  <span>{it.sourceAgent}</span>
                  <span className="text-indigo-500">→</span>
                  <span>{it.targetAgent}</span>
                </div>
                {it.summary && (
                  <details className="text-xs mt-2">
                    <summary className="cursor-pointer text-slate-600 hover:text-indigo-700 font-medium">
                      Handoff Context
                    </summary>
                    <pre className="mt-2 bg-white p-2 rounded border border-indigo-200 overflow-auto text-slate-700">
                      {it.summary}
                    </pre>
                  </details>
                )}
              </div>
            );
          case 'reasoning':
            return (
              <details
                key={`${it.kind}-${it.id}-${it.seq}`}
                className="border border-slate-300 rounded-lg p-3 bg-slate-100"
              >
                <summary className="cursor-pointer text-xs text-slate-600 hover:text-slate-900 font-medium">
                  💭 {it.agent ?? 'agent'} · reasoning
                </summary>
                <pre className="text-xs whitespace-pre-wrap mt-2 bg-white p-2 rounded border border-slate-200 text-slate-700">
                  {it.text}
                </pre>
              </details>
            );
        }
      })}
      <div ref={bottomRef} />
    </div>
  );
}
