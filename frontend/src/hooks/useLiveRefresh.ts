import { useEffect, useRef } from 'react';

interface LiveRefreshOptions {
  enabled: boolean;
  /** Intervalo do polling de seguranca (so corre com o separador visivel). */
  intervalMs?: number;
}

/**
 * Mantem um ecra fresco sem F5: refaz o pedido (a) quando chega um push (o
 * service worker avisa as janelas abertas), (b) quando o separador volta a
 * ficar visivel/focado, (c) de X em X segundos enquanto esta visivel. O
 * polling cobre o caso do push nao chegar (browser sem permissao, iOS...).
 */
export function useLiveRefresh(refresh: () => void, { enabled, intervalMs = 10000 }: LiveRefreshOptions): void {
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (!enabled) return undefined;
    const run = () => {
      if (document.visibilityState === 'visible') refreshRef.current();
    };
    const timer = window.setInterval(run, intervalMs);
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: unknown } | null;
      if (data && data.type === 'pmaxing-push') refreshRef.current();
    };
    document.addEventListener('visibilitychange', run);
    window.addEventListener('focus', run);
    navigator.serviceWorker?.addEventListener('message', onMessage);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', run);
      window.removeEventListener('focus', run);
      navigator.serviceWorker?.removeEventListener('message', onMessage);
    };
  }, [enabled, intervalMs]);
}
