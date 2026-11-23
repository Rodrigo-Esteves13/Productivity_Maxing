import { useCallback, useEffect, useRef, useState } from 'react';
import { getRatingStats } from '../api/areaRatingsService';
import { isRequestCanceled } from '../lib/abortable';
import { useAcademic } from '../context/useAcademic';
import type { RatingStats } from '../types/models';
import { RATING_DOMAINS } from '../lib/domainEvents';
import { useDomainKey } from './useDomainVersion';

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
  // Uma avaliacao gravada noutro cartao refaz as medias em silencio.
  const ratingsKey = useDomainKey(RATING_DOMAINS);
  // Periodo das estatisticas mostradas: so mostra "a carregar" ao mudar de
  // periodo, nao num refetch por avaliacao nova.
  const loadedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (hasNoPeriod) {
      loadedForRef.current = null;
      setStats(null);
      setHasError(false);
      setIsLoading(false);
      return;
    }
    if (isWaitingForPeriod) return;
    const controller = new AbortController();
    const loadKey = periodId ?? '';
    if (loadedForRef.current !== loadKey) setIsLoading(true);
    getRatingStats(periodId, controller.signal)
      .then((result) => {
        loadedForRef.current = loadKey;
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
  }, [periodId, isWaitingForPeriod, hasNoPeriod, attempt, ratingsKey]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { stats, isLoading, hasError, retry };
}
