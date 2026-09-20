import { useEffect, useState } from 'react';
import { getUserAreas } from '../api/userService';
import type { Area } from '../types/models';

export interface UseNotebookAreasResult {
  areas: Area[];
  isLoading: boolean;
  error: string;
}

// periodId: 'all' ou undefined devolve o catálogo global inteiro; um id
// concreto filtra para as Areas que já têm alguma task do user nesse
// período (ver AreasService.findAll) - é o que dá o "só as cadeiras
// deste semestre" no seletor do Notebook.
export function useNotebookAreas(periodId?: string): UseNotebookAreasResult {
  const [areas, setAreas] = useState<Area[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getUserAreas(periodId)
      .then((data) => {
        if (cancelled) return;
        setAreas(data);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Could not load your areas.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [periodId]);

  return { areas, isLoading, error };
}
