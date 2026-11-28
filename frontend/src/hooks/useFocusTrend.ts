import { getFocusTrend } from '../api/studyPlanService';
import { useLoadOnce } from './useLoadOnce';
import { FORECAST_DOMAINS } from '../lib/domainEvents';
import { useStudyDataKey } from './useSessionEndKey';

export function useFocusTrend() {
  const refreshKey = useStudyDataKey(FORECAST_DOMAINS);
  const { data, isLoading, error } = useLoadOnce(getFocusTrend, refreshKey);
  return { weeks: data, isLoading, error };
}
