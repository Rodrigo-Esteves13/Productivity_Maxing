import { useCallback, useEffect, useSyncExternalStore } from 'react';

// Ecra sempre ligado durante o Focus (Screen Wake Lock API). O browser larga
// o lock sozinho quando a tab fica escondida, por isso volta a pedi-lo ao
// regressar. Sem suporte (browsers antigos) nao faz nada.

const STORAGE_KEY = 'pm-focus-keep-screen-on';
const listeners = new Set<() => void>();

export function isWakeLockSupported(): boolean {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
}

// Por omissao ligado: quem estuda com o telemovel pousado nao quer o ecra a apagar.
function read(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

export function useKeepScreenOnPref() {
  const keepScreenOn = useSyncExternalStore(subscribe, read, () => true);
  const setKeepScreenOn = useCallback((value: boolean) => {
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // Best-effort, como os outros prefs hooks.
    }
    listeners.forEach((listener) => listener());
  }, []);
  return { keepScreenOn, setKeepScreenOn };
}

interface WakeLockHost {
  visibilityState: DocumentVisibilityState;
  addEventListener: (type: 'visibilitychange', fn: () => void) => void;
  removeEventListener: (type: 'visibilitychange', fn: () => void) => void;
}

/** Segura o lock do ecra e volta a pedi-lo quando a tab regressa. Devolve a funcao que o larga. */
export function holdWakeLock(wakeLock: WakeLock, host: WakeLockHost): () => void {
  let sentinel: WakeLockSentinel | null = null;
  let cancelled = false;

  const acquire = async () => {
    if (host.visibilityState !== 'visible') return;
    try {
      const lock = await wakeLock.request('screen');
      if (cancelled) void lock.release();
      else sentinel = lock;
    } catch {
      // Recusado (bateria fraca, politica do browser): segue sem lock.
    }
  };

  const onVisibility = () => {
    if (host.visibilityState === 'visible' && (!sentinel || sentinel.released)) void acquire();
  };

  void acquire();
  host.addEventListener('visibilitychange', onVisibility);
  return () => {
    cancelled = true;
    host.removeEventListener('visibilitychange', onVisibility);
    if (sentinel && !sentinel.released) void sentinel.release();
  };
}

export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !isWakeLockSupported()) return;
    return holdWakeLock(navigator.wakeLock, document);
  }, [active]);
}
