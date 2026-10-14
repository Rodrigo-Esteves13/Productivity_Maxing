import { useEffect, useState } from 'react';
import { getWeightBudget, type WeightBudget } from '../api/gradeComponentsService';

// Quanto da nota final da cadeira (neste periodo) ja esta atribuido.
// Sem cadeira ou periodo -> null (nao ha nada a mostrar).
export function useWeightBudget(areaId: string, periodId: string | null | undefined, excludeTaskId?: string, refreshKey = 0) {
  const [budget, setBudget] = useState<WeightBudget | null>(null);

  useEffect(() => {
    if (!areaId || !periodId) {
      setBudget(null);
      return;
    }
    let cancelled = false;
    getWeightBudget({ areaId, periodId, excludeTaskId })
      .then((data) => {
        if (!cancelled) setBudget(data);
      })
      .catch(() => {
        if (!cancelled) setBudget(null);
      });
    return () => {
      cancelled = true;
    };
  }, [areaId, periodId, excludeTaskId, refreshKey]);

  return budget;
}
