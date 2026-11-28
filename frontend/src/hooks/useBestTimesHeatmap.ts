import { getStudyHeatmap } from '../api/studySessionsService';
import type { HeatmapCell } from '../types/models';
import { translateNow } from '../i18n/translate';
import { useFetch } from './useFetch';

const NO_CELLS: HeatmapCell[] = [];
const fetchHeatmap = () => getStudyHeatmap();

// `refreshKey`: quando muda (ex: a sessao ativa acabou), volta a pedir o
// heatmap, para a sessao acabada de gravar aparecer sem recarregar a pagina.
// O refetch e silencioso: o cartao mantem os dados.
export function useBestTimesHeatmap(refreshKey?: string | null) {
  const { data, isLoading, hasError } = useFetch(fetchHeatmap, { refreshKey, clearErrorOnStart: true });
  const cells = data ?? NO_CELLS;
  const error = hasError ? translateNow('hook.couldNotLoadTheHeatmap') : '';
  const hasAnyData = cells.some((cell) => cell.sessionCount > 0);

  return { cells, isLoading, error, hasAnyData };
}
