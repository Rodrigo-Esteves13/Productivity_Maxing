import { readPersisted, usePersistedState, type PersistedCodec } from './usePersistedState';

export const PALETTE_SHORTCUTS_KEY = 'palette-shortcuts-enabled';
const DEFAULT_ENABLED = true;

const CODEC: PersistedCodec<boolean> = {
  parse: (raw) => (raw === null ? DEFAULT_ENABLED : raw === 'true'),
};

export function readPaletteShortcutsEnabled(): boolean {
  return readPersisted(PALETTE_SHORTCUTS_KEY, CODEC);
}

// "?", "g" + letra e recentes da paleta ligados/desligados (por dispositivo).
// Varias instancias (Host, paleta, Perfil) ficam em sincronia.
// Ctrl/Cmd+K nunca depende disto.
export function usePaletteShortcutsPref() {
  const [enabled, setEnabled] = usePersistedState(PALETTE_SHORTCUTS_KEY, CODEC);
  return { enabled, setEnabled, isDefault: enabled === DEFAULT_ENABLED };
}
