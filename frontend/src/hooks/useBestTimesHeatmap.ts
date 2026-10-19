import { useCallback, useEffect, useState } from 'react';
import { getStudyHeatmap } from '../api/studySessionsService';
import type { HeatmapCell } from '../types/models';
import { translateNow } from '../i18n/translate';

export function useBestTimesHeatmap() {
  const [cells, setCells] = useState<HeatmapCell[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchHeatmap = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      const data = await getStudyHeatmap();
      setCells(data);
    } catch {
      setError(translateNow('hook.couldNotLoadTheHeatmap'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchHeatmap();
  }, [fetchHeatmap]);

  const hasAnyData = cells.some((cell) => cell.sessionCount > 0);

  return { cells, isLoading, error, hasAnyData };
}
