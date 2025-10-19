import { useEffect, useReducer, useRef } from 'react';
import { initialRunState, reduceEvent } from './normalize';

type Options = {
  url: string;
  protocols?: string | string[];
  reconnect?: boolean;
  maxRetries?: number;
  retryBaseMs?: number;
};

export function useRunWS({
  url,
  protocols,
  reconnect = true,
  maxRetries = 6,
  retryBaseMs = 300,
}: Options) {
  const [state, dispatch] = useReducer(
    (s: typeof initialRunState, ev: any) => reduceEvent(s, ev),
    initialRunState,
  );

  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const closedByUserRef = useRef(false);

  function connect() {
    const ws = new WebSocket(url, protocols);
    wsRef.current = ws;

    ws.onopen = () => {
      retriesRef.current = 0;
      // İstersen burada start mesajını yolla; sayfada ayrı effect varsa gerek yok
      // ws.send(JSON.stringify({ kind: 'start' }))
    };

    ws.onmessage = (evt) => {
      try {
        const frames = parseMultiJSON(evt.data);
        for (const obj of frames) {
          // Debug istiyorsan aç
          // console.log('dispatching raw event', obj)
          dispatch(obj);
        }
      } catch (e) {
        console.error('ws parse error', e);
      }
    };

    ws.onclose = () => {
      if (closedByUserRef.current) return;
      if (!reconnect) return;
      if (retriesRef.current >= maxRetries) return;
      const backoff = Math.round(
        retryBaseMs * Math.pow(2, retriesRef.current++),
      );
      setTimeout(connect, backoff);
    };
  }

  useEffect(() => {
    connect();
    return () => {
      closedByUserRef.current = true;
      safeClose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  function stop() {
    closedByUserRef.current = true;
    safeClose();
  }

  function safeClose() {
    const ws = wsRef.current;
    if (!ws) return;
    try {
      ws.close();
    } catch {}
    wsRef.current = null;
  }

  return { state, stop, socket: wsRef, dispatch };
}

function parseMultiJSON(data: any): any[] {
  // Tarayıcı WS genelde string verir
  if (typeof data === 'string') {
    // NDJSON desteği
    const lines = data.split('\n').filter(Boolean);
    if (lines.length > 1) {
      return lines.map((line) => JSON.parse(line));
    }
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [parsed];
  }

  // ArrayBuffer ise UTF-8 kabul et
  if (data instanceof ArrayBuffer) {
    const text = new TextDecoder().decode(new Uint8Array(data));
    return parseMultiJSON(text);
  }

  // Blob nadir; gerekiyorsa reader ile aç
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    // Basit çözüm: destekleme
    console.warn('Blob WS payload not supported in this client');
    return [];
  }

  // Zaten obje ise tek frame
  return [data];
}
