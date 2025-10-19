import React from 'react';
import type { UIRunState } from './types';
import { isHandoffToolName } from './handy';

export function ChatFeed({
  state,
  hideHandoffToolCalls = false,
}: {
  state: UIRunState;
  hideHandoffToolCalls?: boolean;
}) {
  const toolCards = Object.values(state.toolCalls).filter((tc) =>
    hideHandoffToolCalls ? !isHandoffToolName(tc.name) : true,
  );
  return (
    <div className="space-y-6">
      {state.currentAgent && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700 font-medium">
          🤖 Active agent: {state.currentAgent}
        </div>
      )}

      {/* Messages */}
      {state.messages.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-medium">Messages</h3>
          {state.messages
            .sort((a, b) => a.id.localeCompare(b.id))
            .map((m) => (
              <div key={m.id} className="rounded border p-3">
                <div className="text-xs opacity-60">
                  {m.agent ?? 'agent'} · {m.role} {m.done ? '· done' : ''}
                </div>
                {m.text && (
                  <div className="whitespace-pre-wrap mt-1">{m.text}</div>
                )}
                {!!m.images?.length && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {m.images.map((src, i) => (
                      <img
                        key={i}
                        src={src}
                        alt=""
                        className="h-20 w-20 object-cover rounded border"
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
        </section>
      )}

      {/* Tool calls */}
      {toolCards.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-medium">Tool calls</h3>
          {toolCards.map((tc) => (
            <div key={tc.id} className="rounded border p-3">
              <div className="text-xs opacity-60">
                {tc.agent ?? 'agent'} · {tc.name} · {tc.status}
              </div>
              {tc.arguments && (
                <div className="mt-2">
                  <div className="text-xs font-semibold">Arguments</div>
                  <pre className="text-xs overflow-auto mt-1 border rounded p-2 bg-gray-50">
                    {tc.arguments}
                  </pre>
                </div>
              )}
              {tc.output && (
                <div className="mt-2">
                  <div className="text-xs font-semibold">Output</div>
                  <pre className="text-xs overflow-auto mt-1 border rounded p-2 bg-gray-50">
                    {tc.output}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {state.handoffs.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            Handoffs
          </h3>
          {state.handoffs.map((h) => (
            <div
              key={h.id}
              className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm"
            >
              <div className="text-xs text-slate-500 mb-2">handoff</div>
              <div className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <span>{h.sourceAgent}</span>
                <span className="text-blue-500">→</span>
                <span>{h.targetAgent}</span>
              </div>
              {h.payloadSummary && (
                <pre className="text-xs overflow-auto mt-3 border border-slate-200 rounded-lg p-3 bg-slate-50 text-slate-700">
                  {h.payloadSummary}
                </pre>
              )}
            </div>
          ))}
        </section>
      )}

      {state.reasoning.length > 0 && (
        <details className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
          <summary className="cursor-pointer text-sm font-semibold text-slate-700 uppercase tracking-wide hover:text-blue-600 transition-colors">
            Reasoning ({state.reasoning.length})
          </summary>
          <div className="mt-3 space-y-2">
            {state.reasoning.map((r) => (
              <pre
                key={r.id}
                className="rounded-lg border border-slate-200 p-3 text-xs whitespace-pre-wrap bg-slate-50 text-slate-700"
              >
                {r.agent ? `[${r.agent}] ` : ''}
                {r.text}
              </pre>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function StreamingText({ text }: { text: string }) {
  return (
    <div className="whitespace-pre-wrap text-slate-700 leading-relaxed">
      {text}
    </div>
  );
}
