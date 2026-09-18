import { useCallback, useEffect, useState } from 'react';
import { getStudyPlan } from '../api/studyPlanService';
import type { StudyPlanResult } from '../types/models';

export function useStudyPlan(days = 7) {
  const [plan, setPlan] = useState<StudyPlanResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchPlan = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      const data = await getStudyPlan(days);
      setPlan(data);
    } catch {
      setError('Could not generate the study plan.');
    } finally {
      setIsLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void fetchPlan();
  }, [fetchPlan]);

  return { plan, isLoading, error, refetch: fetchPlan };
}
