import { useCallback, useEffect, useRef, useState } from 'react';
import { getStudyPlan, updateStudyPlanSettings } from '../api/studyPlanService';
import type { StudyPlanResult } from '../types/models';
import { isRequestCanceled } from '../lib/abortable';
import { translateNow } from '../i18n/translate';
import { PLAN_DOMAINS } from '../lib/domainEvents';
import { useStudyDataKey } from './useSessionEndKey';

// `externalKey` (opcional): quando muda, refaz o plano em silencio (ex:
// horario importado ou aula desmarcada na pagina Schedule).
export function useStudyPlan(days = 7, externalKey = 0) {
  const [plan, setPlan] = useState<StudyPlanResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  // Depois do primeiro plano, os refetch sao silenciosos (o cartao nao volta
  // ao esqueleto quando uma task ou sessao muda noutro sitio).
  const hasPlanRef = useRef(false);
  // Tasks ou sessoes mudadas noutro cartao (ou sessao terminada): novo plano.
  const refreshKey = useStudyDataKey(PLAN_DOMAINS);

  const fetchPlan = useCallback(
    async (signal?: AbortSignal) => {
      try {
        if (!hasPlanRef.current) setIsLoading(true);
        setError('');
        setPlan(await getStudyPlan(days, signal));
        hasPlanRef.current = true;
        setIsLoading(false);
      } catch (caught) {
        if (isRequestCanceled(caught)) return;
        setError(translateNow('hook.couldNotGenerateTheStudyPlan'));
        setIsLoading(false);
      }
    },
    [days],
  );

  useEffect(() => {
    const controller = new AbortController();
    void fetchPlan(controller.signal);
    return () => controller.abort();
  }, [fetchPlan, refreshKey, externalKey]);

  const setDailyLimit = useCallback(
    async (minutes: number) => {
      try {
        await updateStudyPlanSettings(minutes);
        await fetchPlan();
      } catch {
        setError(translateNow('hook.couldNotSaveTheDailyLimit'));
      }
    },
    [fetchPlan],
  );

  const refetch = useCallback(() => fetchPlan(), [fetchPlan]);

  return { plan, isLoading, error, refetch, setDailyLimit };
}
