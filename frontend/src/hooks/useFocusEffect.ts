import { getFocusEffect } from '../api/studyPlanService';
import { useLoadOnce } from './useLoadOnce';

export function useFocusEffect() {
  const { data, isLoading, error } = useLoadOnce(getFocusEffect);
  return { focusEffect: data, isLoading, error };
}
