import { DEFAULT_STREAK_REST_MODE, isStreakRestMode, type StreakRestMode } from '../lib/streakRest';
import { readPersisted, usePersistedState, type PersistedCodec } from './usePersistedState';

const STORAGE_KEY = 'streak-rest-mode';

const CODEC: PersistedCodec<StreakRestMode> = {
  parse: (raw) => (isStreakRestMode(raw) ? raw : DEFAULT_STREAK_REST_MODE),
};

/** Valor atual fora de React (ex: avisos de conquistas). */
export function readStreakRestMode(): StreakRestMode {
  return readPersisted(STORAGE_KEY, CODEC);
}

// Preferencia de descanso da streak. Mesmo padrao do useAbsenceLimitPref:
// localStorage best-effort, com default e reset.
export function useStreakRestPref() {
  const [mode, setMode] = usePersistedState(STORAGE_KEY, CODEC);
  return {
    mode,
    setMode,
    resetMode: () => setMode(DEFAULT_STREAK_REST_MODE),
    isDefault: mode === DEFAULT_STREAK_REST_MODE,
  };
}
