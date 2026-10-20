import { useEffect, useRef } from 'react';

interface VisibleIntervalOptions {
  enabled?: boolean;
  /** Corre logo ao montar (e quando `enabled` passa a true). */
  immediate?: boolean;
}

/**
 * setInterval que so corre com o separador visivel. Ao voltar ao separador,
 * corre logo se ja passou um intervalo desde a ultima vez (o tick que caiu
 * com ele escondido). Antes, cada separador esquecido em segundo plano
 * continuava a fazer pedidos de X em X segundos o dia todo.
 */
export function useVisibleInterval(
  callback: () => void,
  intervalMs: number,
  { enabled = true, immediate = false }: VisibleIntervalOptions = {},
): void {
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return undefined;
    let lastRun = Date.now();
    const run = () => {
      lastRun = Date.now();
      callbackRef.current();
    };
    if (immediate) run();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') run();
    }, intervalMs);
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastRun >= intervalMs) run();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled, intervalMs, immediate]);
}
