import { useEffect, useRef } from 'react';

// Dois disparos (foco, visibilidade, tick) mais perto do que isto contam como um.
const MIN_GAP_MS = 2000;

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
    let lastRun = 0;
    const run = () => {
      if (document.visibilityState !== 'visible') return;
      // Voltar ao separador dispara visibilitychange E focus quase ao mesmo
      // tempo: antes eram 2 pedidos iguais por ecra.
      const now = Date.now();
      if (now - lastRun < MIN_GAP_MS) return;
      lastRun = now;
      refreshRef.current();
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
