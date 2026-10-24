import { useEffect, useState } from 'react';
import { clampAbsenceLimit, DEFAULT_ABSENCE_LIMIT_PCT } from '../lib/attendanceLimit';

const STORAGE_KEY = 'attendance-absence-limit-pct';

function loadLimit(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === null ? DEFAULT_ABSENCE_LIMIT_PCT : clampAbsenceLimit(Number(raw));
  } catch {
    return DEFAULT_ABSENCE_LIMIT_PCT;
  }
}

// Limite de faltas (% das aulas) usado no AttendanceCard. Mesmo padrao do
// useTableDensity: localStorage best-effort, com default e reset.
export function useAbsenceLimitPref() {
  const [limitPct, setLimitPct] = useState<number>(loadLimit);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(limitPct));
    } catch {
      // Best-effort only.
    }
  }, [limitPct]);

  const setLimit = (value: number) => setLimitPct(clampAbsenceLimit(value));
  const resetLimit = () => setLimitPct(DEFAULT_ABSENCE_LIMIT_PCT);

  return { limitPct, setLimit, resetLimit, isDefault: limitPct === DEFAULT_ABSENCE_LIMIT_PCT };
}
