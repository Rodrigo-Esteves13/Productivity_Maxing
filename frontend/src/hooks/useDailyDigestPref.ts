import { useCallback } from 'react';
import { clearSlot } from '../lib/dailyDigest';
import { todayKey } from '../lib/dateKey';
import { readPersisted, usePersistedState, type PersistedCodec } from './usePersistedState';

const STORAGE_KEY = 'pm-daily-digest-enabled';
const DEFAULT_ENABLED = true;

const CODEC: PersistedCodec<boolean> = {
  parse: (raw) => (raw === null ? DEFAULT_ENABLED : raw === 'true'),
};

export function readDailyDigestEnabled(): boolean {
  return readPersisted(STORAGE_KEY, CODEC);
}

// Resumo diario ligado/desligado (por dispositivo). Reset: volta ao
// valor por omissao e liberta a vaga de hoje.
export function useDailyDigestPref() {
  const [enabled, setEnabled] = usePersistedState(STORAGE_KEY, CODEC);

  const reset = useCallback(() => {
    setEnabled(DEFAULT_ENABLED);
    clearSlot(todayKey());
  }, [setEnabled]);

  return { enabled, setEnabled, reset };
}
