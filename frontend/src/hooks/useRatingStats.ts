import { getRatingStats } from '../api/areaRatingsService';
import { RATING_DOMAINS } from '../lib/domainEvents';
import { useActivePeriodResource } from './useActivePeriodResource';

const fetchStats = (periodId: string | undefined, signal: AbortSignal) => getRatingStats(periodId, signal);

// Estatisticas das avaliacoes do periodo ativo (ver useActivePeriodResource).
// Uma avaliacao gravada noutro cartao refaz as medias em silencio.
export function useRatingStats() {
  const { data, isLoading, hasError, retry } = useActivePeriodResource(fetchStats, { domains: RATING_DOMAINS });

  return { stats: data, isLoading, hasError, retry };
}
