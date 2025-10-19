import { useState } from 'react';
import { UIRunState } from './types';
import { isHandoffToolName } from './handy';

export function OperationsPanel({
  state,
  hideHandoffToolCalls = false,
}: {
  state: UIRunState;
  hideHandoffToolCalls?: boolean;
}) {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  const toggleSection = (section: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const toolCards = Object.values(state.toolCalls).filter((tc) =>
    hideHandoffToolCalls ? !isHandoffToolName(tc.name) : true,
  );

  return (
    <div className="space-y-2">
      {state.currentAgent && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700 font-medium">
          🤖 {state.currentAgent}
        </div>
      )}

      {state.messages.length > 0 && (
        <div className="border border-slate-200 rounded-lg bg-white">
          <button
            onClick={() => toggleSection('messages')}
            className="w-full px-3 py-2 flex items-center justify-between text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <span>Messages ({state.messages.length})</span>
            <span>{openSections.has('messages') ? '▼' : '▶'}</span>
          </button>
          {openSections.has('messages') && (
            <div className="px-3 pb-3 space-y-2 border-t border-slate-200 pt-2">
              {state.messages
                .sort((a, b) => a.id.localeCompare(b.id))
                .map((m) => (
                  <div key={m.id} className="border rounded p-2 text-xs">
                    <div className="opacity-60">
                      {m.agent ?? 'agent'} · {m.role}
                    </div>
                    {m.text && (
                      <div className="mt-1 whitespace-pre-wrap">{m.text}</div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {toolCards.length > 0 && (
        <div className="border border-slate-200 rounded-lg bg-white">
          <button
            onClick={() => toggleSection('tools')}
            className="w-full px-3 py-2 flex items-center justify-between text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <span>Tool Calls ({toolCards.length})</span>
            <span>{openSections.has('tools') ? '▼' : '▶'}</span>
          </button>
          {openSections.has('tools') && (
            <div className="px-3 pb-3 space-y-2 border-t border-slate-200 pt-2">
              {toolCards.map((tc) => (
                <div key={tc.id} className="border rounded p-2 text-xs">
                  <div className="opacity-60">
                    {tc.agent ?? 'agent'} · {tc.name}
                  </div>
                  <div className="mt-1 font-medium">{tc.status}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {state.handoffs.length > 0 && (
        <div className="border border-slate-200 rounded-lg bg-white">
          <button
            onClick={() => toggleSection('handoffs')}
            className="w-full px-3 py-2 flex items-center justify-between text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <span>Handoffs ({state.handoffs.length})</span>
            <span>{openSections.has('handoffs') ? '▼' : '▶'}</span>
          </button>
          {openSections.has('handoffs') && (
            <div className="px-3 pb-3 space-y-2 border-t border-slate-200 pt-2">
              {state.handoffs.map((h) => (
                <div key={h.id} className="border rounded p-2 text-xs">
                  <div>
                    {h.sourceAgent} → {h.targetAgent}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {state.reasoning.length > 0 && (
        <div className="border border-slate-200 rounded-lg bg-white">
          <button
            onClick={() => toggleSection('reasoning')}
            className="w-full px-3 py-2 flex items-center justify-between text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <span>Reasoning ({state.reasoning.length})</span>
            <span>{openSections.has('reasoning') ? '▼' : '▶'}</span>
          </button>
          {openSections.has('reasoning') && (
            <div className="px-3 pb-3 space-y-2 border-t border-slate-200 pt-2">
              {state.reasoning.map((r) => (
                <div
                  key={r.id}
                  className="border rounded p-2 text-xs whitespace-pre-wrap"
                >
                  {r.agent ? `[${r.agent}] ` : ''}
                  {r.text}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
