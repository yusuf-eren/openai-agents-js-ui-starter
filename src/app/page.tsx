'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRunWS } from '../ui/useRunWS';
import { OperationsPanel } from '../ui/OperationsPanel';
import { Timeline } from '../ui/Timeline';
import { Approvals } from '../ui/Approvals';
import { Composer } from '../ui/Composer';

export default function App() {
  const searchParams = useSearchParams();

  const { state, stop, socket, dispatch } = useRunWS({
    url: 'ws://localhost:8787',
    reconnect: false,
  });

  useEffect(() => {
    if (state.conversationId) {
      const url = new URL(window.location.href);
      if (url.searchParams.get('conversationId') !== state.conversationId) {
        url.searchParams.set('conversationId', state.conversationId);
        window.history.pushState({}, '', url.toString());
      }
    }
  }, [state.conversationId]);

  const [resolved, setResolved] = useState<string[]>([]);
  const [isOperationsOpen, setIsOperationsOpen] = useState(false);

  const visibleApprovals = useMemo(
    () => state.approvals.filter((a) => !resolved.includes(a.id)),
    [state.approvals, resolved],
  );

  const sendMessage = useCallback(
    (text: string) => {
      const ws = socket.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      if (visibleApprovals.length) return;

      dispatch({ type: 'local_user_message', text });

      const conversationId =
        state.conversationId || searchParams.get('conversationId') || undefined;

      ws.send(
        JSON.stringify({
          kind: 'message',
          conversationId,
          message: text,
        }),
      );
    },
    [
      socket,
      state.conversationId,
      visibleApprovals.length,
      dispatch,
      searchParams,
    ],
  );

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-slate-50">
      <div className="max-w-7xl mx-auto w-full h-full flex flex-col p-4">
        <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
          <aside
            className={`transition-all duration-300 flex-shrink-0 ${isOperationsOpen ? 'w-80' : 'w-12'}`}
          >
            <div className="h-full flex flex-col gap-2">
              <button
                onClick={() => setIsOperationsOpen(!isOperationsOpen)}
                className="bg-white border border-slate-200 rounded-lg p-2 hover:bg-slate-100 transition-colors shadow-sm flex-shrink-0"
                title={
                  isOperationsOpen ? 'Close Operations' : 'Open Operations'
                }
              >
                <div className="flex items-center justify-center">
                  <span className="text-slate-600">
                    {isOperationsOpen ? '◀' : '▶'}
                  </span>
                </div>
              </button>

              {isOperationsOpen && (
                <div className="flex-1 flex flex-col gap-2 min-h-0 overflow-hidden">
                  <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm overflow-auto flex-1 min-h-0">
                    <OperationsPanel state={state} hideHandoffToolCalls />
                  </div>
                  <button
                    onClick={stop}
                    className="bg-red-500 hover:bg-red-600 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors shadow-sm flex-shrink-0"
                  >
                    Stop Execution
                  </button>
                </div>
              )}
            </div>
          </aside>

          <main className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white border border-slate-200 rounded-lg shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3 flex-shrink-0">
              <h1 className="text-lg font-semibold text-slate-800">Timeline</h1>
              <p className="text-xs text-slate-500">
                Real-time agent execution stream
              </p>
            </div>

            <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 min-h-0">
              <div className="max-w-4xl mx-auto">
                <Timeline state={state} hideHandoffToolCalls />
              </div>
            </div>

            <div className="border-t border-slate-200 p-4 flex-shrink-0">
              <div className="max-w-4xl mx-auto">
                <Composer
                  onSend={sendMessage}
                  disabled={!!visibleApprovals.length}
                />
              </div>
            </div>
          </main>
        </div>
      </div>

      <Approvals
        approvals={visibleApprovals}
        socket={socket}
        onResolved={(ids) => setResolved((prev) => [...prev, ...ids])}
      />
    </div>
  );
}
