import { getFocusScatter } from '../api/studyPlanService';
import { useLoadOnce } from './useLoadOnce';
import { FORECAST_DOMAINS } from '../lib/domainEvents';
import { useStudyDataKey } from './useSessionEndKey';

export function useFocusScatter() {
  const refreshKey = useStudyDataKey(FORECAST_DOMAINS);
  const { data, isLoading, error } = useLoadOnce(getFocusScatter, refreshKey);
  return { points: data, isLoading, error };
}
