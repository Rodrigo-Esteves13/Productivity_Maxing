import { useSyncExternalStore } from 'react';
import { DEFAULT_STREAK_REST_MODE, isStreakRestMode, type StreakRestMode } from '../lib/streakRest';

const STORAGE_KEY = 'streak-rest-mode';

function load(): StreakRestMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return isStreakRestMode(raw) ? raw : DEFAULT_STREAK_REST_MODE;
  } catch {
    return DEFAULT_STREAK_REST_MODE;
  }
}

// Store de modulo: varias instancias do hook (stats e cartao) ficam sincronizadas.
let current: StreakRestMode = load();
const listeners = new Set<() => void>();

function write(mode: StreakRestMode) {
  if (mode === current) return;
  current = mode;
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Best-effort only.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Preferencia de descanso da streak. Mesmo padrao do useAbsenceLimitPref:
// localStorage best-effort, com default e reset.
export function useStreakRestPref() {
  const mode = useSyncExternalStore(subscribe, () => current, () => DEFAULT_STREAK_REST_MODE);
  return {
    mode,
    setMode: write,
    resetMode: () => write(DEFAULT_STREAK_REST_MODE),
    isDefault: mode === DEFAULT_STREAK_REST_MODE,
  };
}
