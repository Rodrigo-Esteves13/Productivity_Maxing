import { usePersistedState, type PersistedCodec } from './usePersistedState';
import { clampNoLeisureGoal, DEFAULT_NO_LEISURE_GOAL, parseStoredNoLeisureGoal } from '../lib/noLeisureDays';

const STORAGE_KEY = 'no-leisure-days-goal';

const CODEC: PersistedCodec<number> = {
  parse: parseStoredNoLeisureGoal,
};

// Meta de dias sem lazer por mes. Mesmo padrao do useAbsenceLimitPref.
export function useNoLeisureGoalPref() {
  const [goal, setGoalState] = usePersistedState(STORAGE_KEY, CODEC);

  const setGoal = (value: number) => setGoalState(clampNoLeisureGoal(value));
  const resetGoal = () => setGoalState(DEFAULT_NO_LEISURE_GOAL);

  return { goal, setGoal, resetGoal, isDefault: goal === DEFAULT_NO_LEISURE_GOAL };
}
