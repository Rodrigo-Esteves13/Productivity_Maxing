import { useEffect, useState } from 'react';
import { getDistractionStats, type DistractionStats } from '../api/studySessionsService';
import { translateNow } from '../i18n/translate';

// `refreshKey`: quando muda (a sessao ativa acabou), volta a pedir, para a
// sessao acabada de gravar entrar nas contas.
export function useDistractionStats(refreshKey?: string | null) {
  const [stats, setStats] = useState<DistractionStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError('');
    getDistractionStats(undefined, controller.signal)
      .then((data) => setStats(data))
      .catch(() => {
        if (!controller.signal.aborted) setError(translateNow('distractionStats.error'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [refreshKey]);

  return { stats, isLoading, error };
}
