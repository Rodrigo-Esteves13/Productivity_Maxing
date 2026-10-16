import { useEffect, useState } from 'react';
import { getWeightBudgets, type WeightBudgets } from '../api/gradeComponentsService';

// Orcamento de peso (usado / em falta) de todas as cadeiras do periodo.
// `refreshKey` forca novo pedido quando as tasks mudam.
export function useWeightBudgets(periodId: string | null | undefined, refreshKey = 0) {
  const [data, setData] = useState<WeightBudgets | null>(null);

  useEffect(() => {
    if (!periodId) return;
    let cancelled = false;
    getWeightBudgets(periodId)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [periodId, refreshKey]);

  return periodId ? data : null;
}
