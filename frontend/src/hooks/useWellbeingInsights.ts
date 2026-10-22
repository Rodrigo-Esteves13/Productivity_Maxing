import { getWellbeingInsights } from '../api/wellbeingService';
import { useLoadOnce } from './useLoadOnce';

export function useWellbeingInsights(refreshKey?: string | null) {
  const { data, isLoading, error } = useLoadOnce(getWellbeingInsights, refreshKey);
  return { insights: data, isLoading, error };
}
