import { getPlanScenario } from '../api/studyPlanService';
import { useLoadOnce } from './useLoadOnce';

export function usePlanScenario() {
  const { data, isLoading, error, reload } = useLoadOnce(getPlanScenario);
  return { scenario: data, isLoading, error, reload };
}
