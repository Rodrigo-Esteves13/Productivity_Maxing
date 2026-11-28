import { usePersistedState, type PersistedCodec } from './usePersistedState';
import { clampHoursPerCredit, DEFAULT_HOURS_PER_CREDIT, parseStoredHoursPerCredit } from '../lib/ectsWorkload';

const STORAGE_KEY = 'ects-hours-per-credit';

const CODEC: PersistedCodec<number> = {
  parse: parseStoredHoursPerCredit,
};

// Horas de trabalho por credito do cartao "ECTS workload". Mesmo padrao do
// useAbsenceLimitPref: localStorage best-effort, com default e reset.
export function useEctsHoursPref() {
  const [hoursPerCredit, setHoursPerCredit] = usePersistedState(STORAGE_KEY, CODEC);

  const setHours = (value: number) => setHoursPerCredit(clampHoursPerCredit(value));
  const resetHours = () => setHoursPerCredit(DEFAULT_HOURS_PER_CREDIT);

  return { hoursPerCredit, setHours, resetHours, isDefault: hoursPerCredit === DEFAULT_HOURS_PER_CREDIT };
}
