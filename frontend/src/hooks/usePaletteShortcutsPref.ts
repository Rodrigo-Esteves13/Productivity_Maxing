import { useCallback, useSyncExternalStore } from 'react';

export const PALETTE_SHORTCUTS_KEY = 'palette-shortcuts-enabled';
const DEFAULT_ENABLED = true;
const CHANGE_EVENT = 'pmaxing:palette-shortcuts-pref';

export function readPaletteShortcutsEnabled(): boolean {
  try {
    const raw = localStorage.getItem(PALETTE_SHORTCUTS_KEY);
    return raw === null ? DEFAULT_ENABLED : raw === 'true';
  } catch {
    return DEFAULT_ENABLED;
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

// "?", "g" + letra e recentes da paleta ligados/desligados (por dispositivo).
// Varias instancias (Host, paleta, Perfil) ficam em sincronia via evento.
// Ctrl/Cmd+K nunca depende disto.
export function usePaletteShortcutsPref() {
  const enabled = useSyncExternalStore(subscribe, readPaletteShortcutsEnabled, () => DEFAULT_ENABLED);

  const setEnabled = useCallback((next: boolean) => {
    try {
      localStorage.setItem(PALETTE_SHORTCUTS_KEY, String(next));
    } catch {
      // Best-effort only.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { enabled, setEnabled, isDefault: enabled === DEFAULT_ENABLED };
}
