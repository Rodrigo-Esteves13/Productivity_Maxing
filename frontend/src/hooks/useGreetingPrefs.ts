import { useCallback } from 'react';
import { clampCustomGreeting } from '../lib/greeting';
import { usePersistedState, type PersistedCodec } from './usePersistedState';

export interface GreetingPrefs {
  customGreeting: string;
  showMotivation: boolean;
}

const STORAGE_KEY_PREFIX = 'greeting-prefs';
const DEFAULT_PREFS: GreetingPrefs = { customGreeting: '', showMotivation: true };

function storageKey(userId: string | undefined): string {
  return `${STORAGE_KEY_PREFIX}:${userId ?? 'anonymous'}`;
}

const CODEC: PersistedCodec<GreetingPrefs> = {
  parse: (raw) => {
    if (!raw) return DEFAULT_PREFS;
    try {
      const parsed = JSON.parse(raw) as Partial<GreetingPrefs>;
      return {
        customGreeting: typeof parsed.customGreeting === 'string' ? clampCustomGreeting(parsed.customGreeting) : '',
        showMotivation: typeof parsed.showMotivation === 'boolean' ? parsed.showMotivation : true,
      };
    } catch {
      return DEFAULT_PREFS;
    }
  },
  serialize: (prefs) => JSON.stringify(prefs),
};

// Saudacao personalizada + frase do dia, guardadas por utilizador neste
// dispositivo. Mesmo padrao dos outros hooks de preferencias.
export function useGreetingPrefs(userId: string | undefined) {
  // A chave leva o userId: trocar de conta le as preferencias dessa conta.
  const [prefs, setPrefs] = usePersistedState(storageKey(userId), CODEC);

  const setCustomGreeting = useCallback(
    (value: string) => setPrefs((prev) => ({ ...prev, customGreeting: clampCustomGreeting(value) })),
    [setPrefs],
  );

  const setShowMotivation = useCallback(
    (value: boolean) => setPrefs((prev) => ({ ...prev, showMotivation: value })),
    [setPrefs],
  );

  return { ...prefs, setCustomGreeting, setShowMotivation };
}
