import { getGradeProjection } from '../api/studyPlanService';
import { FORECAST_DOMAINS } from '../lib/domainEvents';
import { useLoadOnce } from './useLoadOnce';
import { useStudyDataKey } from './useSessionEndKey';

export function useGradeProjection() {
  // Tasks, notas ou sessoes mudadas noutro cartao: volta a ler em silencio.
  const refreshKey = useStudyDataKey(FORECAST_DOMAINS);
  const { data, isLoading, error, reload } = useLoadOnce(getGradeProjection, refreshKey);
  return { projection: data, isLoading, error, reload };
}
