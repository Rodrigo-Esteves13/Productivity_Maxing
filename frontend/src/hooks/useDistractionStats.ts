import { getDistractionStats } from '../api/studySessionsService';
import { translateNow } from '../i18n/translate';
import { useFetch } from './useFetch';

const fetchStats = (signal: AbortSignal) => getDistractionStats(undefined, signal);

// `refreshKey`: quando muda (a sessao ativa acabou), volta a pedir, para a
// sessao acabada de gravar entrar nas contas. O refetch e silencioso: o
// cartao mantem os dados.
export function useDistractionStats(refreshKey?: string | null) {
  const { data, isLoading, hasError } = useFetch(fetchStats, { refreshKey, clearErrorOnStart: true });

  return { stats: data, isLoading, error: hasError ? translateNow('distractionStats.error') : '' };
}
