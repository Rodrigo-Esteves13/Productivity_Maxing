import { useCallback, useEffect, useState } from 'react';
import { getStudyPlan, updateStudyPlanSettings } from '../api/studyPlanService';
import type { StudyPlanResult } from '../types/models';
import { isRequestCanceled } from '../lib/abortable';
import { translateNow } from '../i18n/translate';

export function useStudyPlan(days = 7) {
  const [plan, setPlan] = useState<StudyPlanResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchPlan = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setIsLoading(true);
        setError('');
        setPlan(await getStudyPlan(days, signal));
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
  }, [fetchPlan]);

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
