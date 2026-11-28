import { usePersistedState, type PersistedCodec } from './usePersistedState';
import { clampAbsenceLimit, DEFAULT_ABSENCE_LIMIT_PCT } from '../lib/attendanceLimit';

const STORAGE_KEY = 'attendance-absence-limit-pct';

const CODEC: PersistedCodec<number> = {
  parse: (raw) => (raw === null ? DEFAULT_ABSENCE_LIMIT_PCT : clampAbsenceLimit(Number(raw))),
};

// Limite de faltas (% das aulas) usado no AttendanceCard. Mesmo padrao do
// useTableDensity: localStorage best-effort, com default e reset.
export function useAbsenceLimitPref() {
  const [limitPct, setLimitPct] = usePersistedState(STORAGE_KEY, CODEC);

  const setLimit = (value: number) => setLimitPct(clampAbsenceLimit(value));
  const resetLimit = () => setLimitPct(DEFAULT_ABSENCE_LIMIT_PCT);

  return { limitPct, setLimit, resetLimit, isDefault: limitPct === DEFAULT_ABSENCE_LIMIT_PCT };
}
