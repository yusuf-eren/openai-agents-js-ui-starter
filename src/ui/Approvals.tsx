import React, { useEffect, useMemo, useState } from 'react';
import type { UIApprovalRequest } from './types';

type Props = {
  approvals: UIApprovalRequest[];
  socket: React.MutableRefObject<WebSocket | null>;
  onResolved?: (callIds: string[]) => void; // UI'dan temizlemek için
};

export function Approvals({ approvals, socket, onResolved }: Props) {
  const [isOpen, setIsOpen] = useState(approvals.length > 0);
  const [decisions, setDecisions] = useState<
    Map<string, 'approved' | 'rejected'>
  >(new Map());

  useEffect(() => {
    setIsOpen(approvals.length > 0);
    setDecisions(new Map());
  }, [approvals]);

  const pending = useMemo(() => approvals.map((a) => a.id), [approvals]);

  const decide = (id: string, v: 'approved' | 'rejected') => {
    setDecisions((prev) => {
      const m = new Map(prev);
      m.set(id, v);
      return m;
    });
  };

  const allDecided =
    decisions.size === approvals.length && approvals.length > 0;

  const sendDecisions = () => {
    const ws = socket.current;
    console.log(
      'sendDecisions',
      decisions,
      ws.readyState,
      WebSocket.OPEN,
      WebSocket.CLOSED,
      WebSocket.CLOSING,
      WebSocket.CONNECTING,
    );
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    // Karar formatı: { kind: 'approvals', decisions: [{ callId, decision }] }
    const payload = {
      kind: 'approvals',
      decisions: Array.from(decisions.entries()).map(([callId, decision]) => ({
        callId,
        decision,
      })),
    };
    ws.send(JSON.stringify(payload));
    setIsOpen(false);
    onResolved?.(pending);
  };

  if (!isOpen || approvals.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-2xl border border-slate-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-2xl">
            ⚠️
          </div>
          <div>
            <div className="text-lg font-semibold text-slate-800">Approval Required</div>
            <div className="text-sm text-slate-500">
              {approvals[0].agent ?? 'agent'} requests your approval for {approvals.length} tool{approvals.length > 1 ? 's' : ''}
            </div>
          </div>
        </div>

        <div className="space-y-3 max-h-[60vh] overflow-auto">
          {approvals.map((a) => (
            <div key={a.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-slate-600">
                  <span className="font-medium">{a.agent ?? 'agent'}</span>
                  <span className="mx-1">·</span>
                  <span className="font-mono text-blue-600">{a.toolName}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    className={`border rounded-lg px-3 py-1 text-sm font-medium transition-colors ${
                      decisions.get(a.id) === 'approved' 
                        ? 'bg-green-500 text-white border-green-500' 
                        : 'border-slate-300 text-slate-700 hover:bg-green-50 hover:border-green-300'
                    }`}
                    onClick={() => decide(a.id, 'approved')}
                  >
                    ✓ Approve
                  </button>
                  <button
                    className={`border rounded-lg px-3 py-1 text-sm font-medium transition-colors ${
                      decisions.get(a.id) === 'rejected' 
                        ? 'bg-red-500 text-white border-red-500' 
                        : 'border-slate-300 text-slate-700 hover:bg-red-50 hover:border-red-300'
                    }`}
                    onClick={() => decide(a.id, 'rejected')}
                  >
                    ✕ Reject
                  </button>
                </div>
              </div>
              <details className="text-xs">
                <summary className="cursor-pointer text-slate-600 hover:text-slate-900 font-medium">
                  View Arguments
                </summary>
                <pre className="mt-2 whitespace-pre-wrap bg-white p-3 rounded-lg border border-slate-200 text-slate-700">
                  {a.arguments}
                </pre>
              </details>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            className="border border-slate-300 rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            onClick={() => setIsOpen(false)}
          >
            Close
          </button>
          <button
            className="bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors shadow-sm"
            disabled={!allDecided}
            onClick={sendDecisions}
          >
            Submit Decisions
          </button>
        </div>
      </div>
    </div>
  );
}
