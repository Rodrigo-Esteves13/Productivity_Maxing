import { getCourseForecast } from '../api/studyPlanService';
import { useLoadOnce } from './useLoadOnce';

export function useCourseForecast() {
  const { data, isLoading, error } = useLoadOnce(getCourseForecast);
  return { courses: data ?? [], isLoading, error };
}
