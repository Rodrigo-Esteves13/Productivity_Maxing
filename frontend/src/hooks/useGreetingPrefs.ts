import { useCallback, useEffect, useState } from 'react';
import { clampCustomGreeting } from '../lib/greeting';

export interface GreetingPrefs {
  customGreeting: string;
  showMotivation: boolean;
}

const STORAGE_KEY_PREFIX = 'greeting-prefs';
const DEFAULT_PREFS: GreetingPrefs = { customGreeting: '', showMotivation: true };

function storageKey(userId: string | undefined): string {
  return `${STORAGE_KEY_PREFIX}:${userId ?? 'anonymous'}`;
}

function loadPrefs(userId: string | undefined): GreetingPrefs {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<GreetingPrefs>;
    return {
      customGreeting: typeof parsed.customGreeting === 'string' ? clampCustomGreeting(parsed.customGreeting) : '',
      showMotivation: typeof parsed.showMotivation === 'boolean' ? parsed.showMotivation : true,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

// Saudacao personalizada + frase do dia, guardadas por utilizador neste
// dispositivo. Mesmo padrao dos outros hooks de preferencias.
export function useGreetingPrefs(userId: string | undefined) {
  const [state, setState] = useState(() => ({ userId, prefs: loadPrefs(userId) }));

  // Troca de conta no mesmo browser: recarrega as preferencias dessa conta.
  if (state.userId !== userId) {
    setState({ userId, prefs: loadPrefs(userId) });
  }
  const prefs = state.userId === userId ? state.prefs : loadPrefs(userId);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(userId), JSON.stringify(prefs));
    } catch {
      // Best-effort: sem storage a preferencia so nao sobrevive ao reload.
    }
  }, [userId, prefs]);

  const setCustomGreeting = useCallback((value: string) => {
    setState((prev) => ({ ...prev, prefs: { ...prev.prefs, customGreeting: clampCustomGreeting(value) } }));
  }, []);

  const setShowMotivation = useCallback((value: boolean) => {
    setState((prev) => ({ ...prev, prefs: { ...prev.prefs, showMotivation: value } }));
  }, []);

  return { ...prefs, setCustomGreeting, setShowMotivation };
}
