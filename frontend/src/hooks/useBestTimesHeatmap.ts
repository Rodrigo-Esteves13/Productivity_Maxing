import { useCallback, useEffect, useState } from 'react';
import { getStudyHeatmap } from '../api/studySessionsService';
import type { HeatmapCell } from '../types/models';
import { translateNow } from '../i18n/translate';

// `refreshKey`: quando muda (ex: a sessao ativa acabou), volta a pedir o
// heatmap, para a sessao acabada de gravar aparecer sem recarregar a pagina.
export function useBestTimesHeatmap(refreshKey?: string | null) {
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
  }, [fetchHeatmap, refreshKey]);

  const hasAnyData = cells.some((cell) => cell.sessionCount > 0);

  return { cells, isLoading, error, hasAnyData };
}
