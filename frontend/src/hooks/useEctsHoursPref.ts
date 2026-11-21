import { useEffect, useState } from 'react';
import { clampHoursPerCredit, DEFAULT_HOURS_PER_CREDIT, parseStoredHoursPerCredit } from '../lib/ectsWorkload';

const STORAGE_KEY = 'ects-hours-per-credit';

function loadHours(): number {
  try {
    return parseStoredHoursPerCredit(localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_HOURS_PER_CREDIT;
  }
}

// Horas de trabalho por credito do cartao "ECTS workload". Mesmo padrao do
// useAbsenceLimitPref: localStorage best-effort, com default e reset.
export function useEctsHoursPref() {
  const [hoursPerCredit, setHoursPerCredit] = useState<number>(loadHours);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(hoursPerCredit));
    } catch {
      // Best-effort only.
    }
  }, [hoursPerCredit]);

  const setHours = (value: number) => setHoursPerCredit(clampHoursPerCredit(value));
  const resetHours = () => setHoursPerCredit(DEFAULT_HOURS_PER_CREDIT);

  return { hoursPerCredit, setHours, resetHours, isDefault: hoursPerCredit === DEFAULT_HOURS_PER_CREDIT };
}
