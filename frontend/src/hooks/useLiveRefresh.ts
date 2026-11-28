import { useCallback, useEffect, useRef } from 'react';
import { useVisibleInterval } from './useVisibleInterval';
import { createLiveRefreshScheduler, type LiveRefreshHandle } from '../lib/liveRefreshScheduler';

interface LiveRefreshOptions {
  enabled: boolean;
  /** Intervalo do polling de seguranca (so corre com o separador visivel). */
  intervalMs?: number;
}

// Um so coordenador e um so conjunto de listeners para a app toda.
const scheduler = createLiveRefreshScheduler(() => document.visibilityState === 'visible');

// Voltar ao separador dispara visibilitychange E focus quase ao mesmo tempo:
// o coordenador junta os dois (fila e intervalo minimo por ecra).
const onReturn = () => scheduler.requestAll();
const onMessage = (event: MessageEvent) => {
  const data = event.data as { type?: unknown } | null;
  if (data && data.type === 'pmaxing-push') scheduler.pushAll();
};

// Os listeners existem enquanto houver pelo menos um ecra registado.
function subscribe(run: () => void): { handle: LiveRefreshHandle; release: () => void } {
  if (scheduler.size() === 0) {
    document.addEventListener('visibilitychange', onReturn);
    window.addEventListener('focus', onReturn);
    navigator.serviceWorker?.addEventListener('message', onMessage);
  }
  const handle = scheduler.register(run);
  return {
    handle,
    release: () => {
      handle.unregister();
      if (scheduler.size() > 0) return;
      document.removeEventListener('visibilitychange', onReturn);
      window.removeEventListener('focus', onReturn);
      navigator.serviceWorker?.removeEventListener('message', onMessage);
    },
  };
}

/**
 * Mantem um ecra fresco sem F5: refaz o pedido (a) quando chega um push (o
 * service worker avisa as janelas abertas), (b) quando o separador volta a
 * ficar visivel/focado, (c) de X em X segundos enquanto esta visivel. O
 * polling cobre o caso do push nao chegar (browser sem permissao, iOS...).
 * Varios ecras ao mesmo tempo pedem a vez ao mesmo coordenador, que escalona
 * os pedidos.
 */
export function useLiveRefresh(refresh: () => void, { enabled, intervalMs = 10000 }: LiveRefreshOptions): void {
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  const handleRef = useRef<LiveRefreshHandle | null>(null);
  const run = useCallback(() => handleRef.current?.request(), []);
  useVisibleInterval(run, intervalMs, { enabled });

  useEffect(() => {
    if (!enabled) return undefined;
    const { handle, release } = subscribe(() => refreshRef.current());
    handleRef.current = handle;
    return () => {
      handleRef.current = null;
      release();
    };
  }, [enabled]);
}
