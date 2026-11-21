import { useEffect, useState } from 'react';
import { clampNoLeisureGoal, DEFAULT_NO_LEISURE_GOAL, parseStoredNoLeisureGoal } from '../lib/noLeisureDays';

const STORAGE_KEY = 'no-leisure-days-goal';

function loadGoal(): number {
  try {
    return parseStoredNoLeisureGoal(localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_NO_LEISURE_GOAL;
  }
}

// Meta de dias sem lazer por mes. Mesmo padrao do useAbsenceLimitPref.
export function useNoLeisureGoalPref() {
  const [goal, setGoalState] = useState<number>(loadGoal);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(goal));
    } catch {
      // Best-effort only.
    }
  }, [goal]);

  const setGoal = (value: number) => setGoalState(clampNoLeisureGoal(value));
  const resetGoal = () => setGoalState(DEFAULT_NO_LEISURE_GOAL);

  return { goal, setGoal, resetGoal, isDefault: goal === DEFAULT_NO_LEISURE_GOAL };
}
