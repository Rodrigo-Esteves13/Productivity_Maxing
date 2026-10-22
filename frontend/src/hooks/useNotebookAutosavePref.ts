import { useCallback, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'pm-notebook-autosave';
const listeners = new Set<() => void>();

// Por omissao ligado: ninguem que nunca mexeu no toggle perde o auto save.
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

// Preferencia local (por dispositivo) do auto save do Notebook. Store externo
// em vez de useState para todas as entradas abertas (e outras tabs) verem a
// mesma escolha ao mesmo tempo.
export function useNotebookAutosavePref() {
  const autosaveEnabled = useSyncExternalStore(subscribe, read, () => true);

  const setAutosaveEnabled = useCallback((value: boolean) => {
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // Best-effort, como os outros prefs hooks.
    }
    listeners.forEach((listener) => listener());
  }, []);

  return { autosaveEnabled, setAutosaveEnabled };
}
