import { useCallback } from 'react';
import { getWeightBudgets } from '../api/gradeComponentsService';
import { GRADE_DOMAINS } from '../lib/domainEvents';
import { useDomainKey } from './useDomainVersion';
import { useFetch } from './useFetch';

// Orcamento de peso (usado / em falta) de todas as cadeiras do periodo.
// Volta a pedir (em silencio) quando uma task ou componente de nota muda em
// qualquer sitio: criar, apagar ou mudar o peso, mesmo que a soma fique igual.
export function useWeightBudgets(periodId: string | null | undefined) {
  const refreshKey = useDomainKey(GRADE_DOMAINS);
  const fetcher = useCallback(() => getWeightBudgets(periodId ?? ''), [periodId]);
  const { data } = useFetch(periodId ? fetcher : null, { refreshKey, clearDataOnError: true });

  return periodId ? data : null;
}
