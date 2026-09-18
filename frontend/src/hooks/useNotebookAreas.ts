import { useEffect, useState } from 'react';
import { getUserAreas } from '../api/userService';
import type { Area } from '../types/models';

export interface UseNotebookAreasResult {
  areas: Area[];
  isLoading: boolean;
  error: string;
}

export function useNotebookAreas(): UseNotebookAreasResult {
  const [areas, setAreas] = useState<Area[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getUserAreas()
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
  }, []);

  return { areas, isLoading, error };
}
