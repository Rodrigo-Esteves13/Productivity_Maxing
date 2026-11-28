import { useCallback } from 'react';
import { getWeightBudget } from '../api/gradeComponentsService';
import { useFetch } from './useFetch';

// Quanto da nota final da cadeira (neste periodo) ja esta atribuido.
// Sem cadeira ou periodo -> null (nao ha nada a mostrar).
export function useWeightBudget(areaId: string, periodId: string | null | undefined, excludeTaskId?: string, refreshKey = 0) {
  const fetcher = useCallback(
    () => getWeightBudget({ areaId, periodId: periodId ?? '', excludeTaskId }),
    [areaId, periodId, excludeTaskId],
  );
  const isEnabled = Boolean(areaId && periodId);
  const { data } = useFetch(isEnabled ? fetcher : null, {
    refreshKey,
    clearDataOnError: true,
    resetWhenDisabled: true,
  });

  return isEnabled ? data : null;
}
