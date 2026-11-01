import { useCallback, useEffect, useState } from 'react';
import { getRatingStats } from '../api/areaRatingsService';
import { isRequestCanceled } from '../lib/abortable';
import { useAcademic } from '../context/useAcademic';
import type { RatingStats } from '../types/models';

// Estatisticas das avaliacoes do periodo ativo (todos na vista agregada),
// como o useCourseRiskOverview. Erro devolve hasError e retry.
export function useRatingStats() {
  const { activePeriod, isViewingAllPeriods, isViewingAllPrograms, isLoading: isAcademicLoading } = useAcademic();
  const periodId = isViewingAllPeriods || isViewingAllPrograms ? undefined : activePeriod?.id;
  // Sem programa/periodo (carregamento academico ja terminou) nao ha o que pedir: estado vazio.
  const hasNoPeriod = !isAcademicLoading && !isViewingAllPeriods && !isViewingAllPrograms && !activePeriod;
  const isWaitingForPeriod = isAcademicLoading || hasNoPeriod;
  const [stats, setStats] = useState<RatingStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (hasNoPeriod) {
      setStats(null);
      setHasError(false);
      setIsLoading(false);
      return;
    }
    if (isWaitingForPeriod) return;
    const controller = new AbortController();
    setIsLoading(true);
    getRatingStats(periodId, controller.signal)
      .then((result) => {
        setStats(result);
        setHasError(false);
        setIsLoading(false);
      })
      .catch((caught: unknown) => {
        if (isRequestCanceled(caught)) return;
        setHasError(true);
        setIsLoading(false);
      });
    return () => controller.abort();
  }, [periodId, isWaitingForPeriod, hasNoPeriod, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { stats, isLoading, hasError, retry };
}
