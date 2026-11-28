import { useContext } from 'react';
import { PlanModeContext } from '../context/plan-mode-context';
import type { GradeScenario } from '../api/academicService';
import { OFF_BY_DEFAULT, usePersistedState } from './usePersistedState';

const STORAGE_KEY = 'pm-plan-mode';

// Preferencia local do modo plano (mesmo formato de useExamMode): desligado
// por omissao, lembrado neste dispositivo.
export function usePlanModePref() {
  const [isPlanMode, setIsPlanMode] = usePersistedState(STORAGE_KEY, OFF_BY_DEFAULT);
  return { isPlanMode, setIsPlanMode };
}

/** Le o modo plano do Dashboard (falso fora dele). */
export function usePlanMode() {
  const value = useContext(PlanModeContext);
  const scenario: GradeScenario = value.isPlanMode ? 'plan' : 'real';
  return { ...value, scenario };
}
