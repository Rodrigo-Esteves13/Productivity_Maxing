import { getCourseForecast } from '../api/studyPlanService';
import { FORECAST_DOMAINS } from '../lib/domainEvents';
import { useLoadOnce } from './useLoadOnce';
import { useStudyDataKey } from './useSessionEndKey';

export function useCourseForecast() {
  // Tasks, notas ou sessoes mudadas noutro cartao: volta a ler em silencio.
  const refreshKey = useStudyDataKey(FORECAST_DOMAINS);
  const { data, isLoading, error } = useLoadOnce(getCourseForecast, refreshKey);
  return { courses: data ?? [], isLoading, error };
}
