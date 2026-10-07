import { useCallback, useEffect, useState } from 'react';
import { getStudyPlan, updateStudyPlanSettings } from '../api/studyPlanService';
import type { StudyPlanResult } from '../types/models';
import { isRequestCanceled } from '../lib/abortable';

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
        setError('Could not generate the study plan.');
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
        setError('Could not save the daily limit.');
      }
    },
    [fetchPlan],
  );

  const refetch = useCallback(() => fetchPlan(), [fetchPlan]);

  return { plan, isLoading, error, refetch, setDailyLimit };
}
