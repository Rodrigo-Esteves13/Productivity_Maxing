import { useCallback, useEffect, useRef, useState } from 'react';
import { getCourseRiskOverview } from '../api/courseRiskService';
import { isRequestCanceled } from '../lib/abortable';
import { useAcademic } from '../context/useAcademic';
import type { CourseRiskOverview } from '../types/models';
import { GRADE_DOMAINS } from '../lib/domainEvents';
import { useDomainKey } from './useDomainVersion';

// Carrega o resumo de risco do periodo ativo (todos na vista agregada) e
// recarrega quando ele muda. Um erro devolve hasError e retry. Sem programa ou
// periodo (carregamento academico ja terminou) nao ha o que pedir: devolve
// needsPeriod, um estado vazio proprio (overview fica null mas nao e erro).
export function useCourseRiskOverview(absenceLimitPct?: number) {
  const { activePeriod, isViewingAllPeriods, isViewingAllPrograms, isLoading: isAcademicLoading } = useAcademic();
  const periodId = isViewingAllPeriods || isViewingAllPrograms ? undefined : activePeriod?.id;
  const needsPeriod = !isAcademicLoading && !isViewingAllPeriods && !isViewingAllPrograms && !activePeriod;
  const isWaitingForPeriod = isAcademicLoading || needsPeriod;
  const [overview, setOverview] = useState<CourseRiskOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // Concluir uma task, lancar uma nota ou mudar um peso noutro cartao refaz o
  // risco em silencio (o cartao mantem o que tinha enquanto pede).
  const dataKey = useDomainKey(GRADE_DOMAINS);
  // Pedido cujos dados estao no ecra: so mostra "a carregar" se mudar.
  const loadedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (needsPeriod) {
      loadedForRef.current = null;
      setOverview(null);
      setHasError(false);
      setIsLoading(false);
      return;
    }
    if (isWaitingForPeriod) return;
    const controller = new AbortController();
    const loadKey = `${absenceLimitPct ?? ''}|${periodId ?? ''}`;
    if (loadedForRef.current !== loadKey) setIsLoading(true);
    getCourseRiskOverview({ absenceLimitPct, periodId }, controller.signal)
      .then((result) => {
        loadedForRef.current = loadKey;
        setOverview(result);
        setHasError(false);
        setIsLoading(false);
      })
      .catch((caught: unknown) => {
        if (isRequestCanceled(caught)) return;
        setHasError(true);
        setIsLoading(false);
      });
    return () => controller.abort();
  }, [absenceLimitPct, periodId, isWaitingForPeriod, needsPeriod, attempt, dataKey]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { overview, isLoading, hasError, needsPeriod, retry };
}
