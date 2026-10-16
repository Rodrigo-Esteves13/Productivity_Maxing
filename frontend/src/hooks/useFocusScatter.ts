import { getFocusScatter } from '../api/studyPlanService';
import { useLoadOnce } from './useLoadOnce';

export function useFocusScatter() {
  const { data, isLoading, error } = useLoadOnce(getFocusScatter);
  return { points: data, isLoading, error };
}
