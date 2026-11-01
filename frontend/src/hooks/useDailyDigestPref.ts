import { useCallback, useState } from 'react';
import { clearSlot } from '../lib/dailyDigest';
import { todayKey } from '../lib/dateKey';

const STORAGE_KEY = 'pm-daily-digest-enabled';
const DEFAULT_ENABLED = true;

export function readDailyDigestEnabled(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === null ? DEFAULT_ENABLED : raw === 'true';
  } catch {
    return DEFAULT_ENABLED;
  }
}

function write(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
    // Best-effort, como os outros prefs hooks.
  }
}

// Resumo diario ligado/desligado (por dispositivo). Reset: volta ao
// valor por omissao e liberta a vaga de hoje.
export function useDailyDigestPref() {
  const [enabled, setEnabledState] = useState<boolean>(readDailyDigestEnabled);

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
    write(next);
  }, []);

  const reset = useCallback(() => {
    setEnabled(DEFAULT_ENABLED);
    clearSlot(todayKey());
  }, [setEnabled]);

  return { enabled, setEnabled, reset };
}
