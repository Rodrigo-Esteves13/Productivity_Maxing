import { useContext, useEffect, useState } from 'react';
import { PlanModeContext } from '../context/plan-mode-context';
import type { GradeScenario } from '../api/academicService';

const STORAGE_KEY = 'pm-plan-mode';

function loadPlanMode(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

// Preferencia local do modo plano (mesmo formato de useExamMode): desligado
// por omissao, lembrado neste dispositivo.
export function usePlanModePref() {
  const [isPlanMode, setIsPlanMode] = useState<boolean>(loadPlanMode);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(isPlanMode));
    } catch {
      // Best-effort, como os outros prefs hooks.
    }
  }, [isPlanMode]);
  return { isPlanMode, setIsPlanMode };
}

/** Le o modo plano do Dashboard (falso fora dele). */
export function usePlanMode() {
  const value = useContext(PlanModeContext);
  const scenario: GradeScenario = value.isPlanMode ? 'plan' : 'real';
  return { ...value, scenario };
}
