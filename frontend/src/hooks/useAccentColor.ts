import { useCallback, useState } from 'react';
import { applyAccent, DEFAULT_ACCENT, loadAccent, saveAccent, type AccentId } from '../lib/accentColor';

// Estado do seletor de cor de destaque; aplica ao <html> e guarda no browser.
// O valor guardado e aplicado no arranque por applyStoredAccent (main.tsx).
export function useAccentColor() {
  const [accent, setAccentState] = useState<AccentId>(loadAccent);

  const setAccent = useCallback((next: AccentId) => {
    setAccentState(next);
    applyAccent(next);
    saveAccent(next);
  }, []);

  const resetAccent = useCallback(() => setAccent(DEFAULT_ACCENT), [setAccent]);

  return { accent, setAccent, resetAccent, isDefault: accent === DEFAULT_ACCENT };
}
