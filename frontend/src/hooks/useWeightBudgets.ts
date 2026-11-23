import { useEffect, useState } from 'react';
import { getWeightBudgets, type WeightBudgets } from '../api/gradeComponentsService';
import { GRADE_DOMAINS } from '../lib/domainEvents';
import { useDomainKey } from './useDomainVersion';

// Orcamento de peso (usado / em falta) de todas as cadeiras do periodo.
// Volta a pedir (em silencio) quando uma task ou componente de nota muda em
// qualquer sitio: criar, apagar ou mudar o peso, mesmo que a soma fique igual.
export function useWeightBudgets(periodId: string | null | undefined) {
  const [data, setData] = useState<WeightBudgets | null>(null);
  const refreshKey = useDomainKey(GRADE_DOMAINS);

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
