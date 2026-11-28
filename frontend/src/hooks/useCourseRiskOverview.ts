import { useCallback } from 'react';
import { getCourseRiskOverview } from '../api/courseRiskService';
import { GRADE_DOMAINS } from '../lib/domainEvents';
import { useActivePeriodResource } from './useActivePeriodResource';

// Carrega o resumo de risco do periodo ativo (ver useActivePeriodResource).
// Concluir uma task, lancar uma nota ou mudar um peso noutro cartao refaz o
// risco em silencio (o cartao mantem o que tinha enquanto pede).
export function useCourseRiskOverview(absenceLimitPct?: number) {
  const fetcher = useCallback(
    (periodId: string | undefined, signal: AbortSignal) =>
      getCourseRiskOverview({ absenceLimitPct, periodId }, signal),
    [absenceLimitPct],
  );
  const { data, ...state } = useActivePeriodResource(fetcher, {
    domains: GRADE_DOMAINS,
    variant: String(absenceLimitPct ?? ''),
  });

  return { overview: data, ...state };
}
