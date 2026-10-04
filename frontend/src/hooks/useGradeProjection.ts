import { getGradeProjection } from '../api/studyPlanService';
import { useLoadOnce } from './useLoadOnce';

export function useGradeProjection() {
  const { data, isLoading, error, reload } = useLoadOnce(getGradeProjection);
  return { projection: data, isLoading, error, reload };
}
