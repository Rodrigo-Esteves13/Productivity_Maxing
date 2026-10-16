import { getFocusTrend } from '../api/studyPlanService';
import { useLoadOnce } from './useLoadOnce';

export function useFocusTrend() {
  const { data, isLoading, error } = useLoadOnce(getFocusTrend);
  return { weeks: data, isLoading, error };
}
