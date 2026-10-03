import { useCallback, useEffect, useState } from 'react';
import { getStudyPlan, updateStudyPlanSettings } from '../api/studyPlanService';
import type { StudyPlanResult } from '../types/models';

export function useStudyPlan(days = 7) {
  const [plan, setPlan] = useState<StudyPlanResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchPlan = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      setPlan(await getStudyPlan(days));
    } catch {
      setError('Could not generate the study plan.');
    } finally {
      setIsLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void fetchPlan();
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

  return { plan, isLoading, error, refetch: fetchPlan, setDailyLimit };
}
