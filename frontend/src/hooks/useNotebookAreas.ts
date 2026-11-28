import { useCallback, useEffect, useState } from 'react';
import { getUserAreas } from '../api/areasService';
import type { Area } from '../types/models';
import { translateNow } from '../i18n/translate';

export interface UseNotebookAreasResult {
  areas: Area[];
  isLoading: boolean;
  error: string;
  reload: () => void;
}

// periodId: 'all' ou undefined devolve o catálogo global inteiro; um id
// concreto filtra para as Areas que já têm alguma task do user nesse
// período (ver AreasService.findAll) - é o que dá o "só as cadeiras
// deste semestre" no seletor do Notebook.
export function useNotebookAreas(periodId?: string): UseNotebookAreasResult {
  const [areas, setAreas] = useState<Area[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError('');
    getUserAreas(periodId)
      .then((data) => {
        if (cancelled) return;
        setAreas(data);
      })
      .catch(() => {
        if (cancelled) return;
        setError(translateNow('hook.couldNotLoadYourAreas'));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [periodId, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  return { areas, isLoading, error, reload };
}
