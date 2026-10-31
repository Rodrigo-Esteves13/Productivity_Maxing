import { useCallback, useEffect, useState } from 'react';
import { getCourseRisk } from '../api/courseRiskService';
import { isRequestCanceled } from '../lib/abortable';
import { useAcademic } from '../context/useAcademic';
import type { CourseRisk } from '../types/models';

// Carrega o risco por cadeira do periodo ativo do Dashboard (todos os periodos
// na vista agregada) e recarrega quando ele muda. Um erro devolve hasError e retry para o
// cartao mostrar uma linha pequena com "tentar de novo".
export function useCourseRisk(absenceLimitPct?: number) {
  const { activePeriod, isViewingAllPeriods, isViewingAllPrograms } = useAcademic();
  const periodId = isViewingAllPeriods || isViewingAllPrograms ? undefined : activePeriod?.id;
  const isWaitingForPeriod = !isViewingAllPeriods && !isViewingAllPrograms && !activePeriod;
  const [risks, setRisks] = useState<CourseRisk[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (isWaitingForPeriod) return;
    const controller = new AbortController();
    setIsLoading(true);
    getCourseRisk({ absenceLimitPct, periodId }, controller.signal)
      .then((result) => {
        setRisks(result);
        setHasError(false);
        setIsLoading(false);
      })
      .catch((caught: unknown) => {
        if (isRequestCanceled(caught)) return;
        setHasError(true);
        setIsLoading(false);
      });
    return () => controller.abort();
  }, [absenceLimitPct, periodId, isWaitingForPeriod, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { risks, isLoading, hasError, retry };
}
