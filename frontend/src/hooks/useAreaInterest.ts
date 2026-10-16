import { useCallback, useEffect, useState } from 'react';
import { clearAreaInterest, getAreaInterests, setAreaInterest } from '../api/areaInterestsService';

// Interesse (1 a 5) do user numa cadeira. Atualiza logo no ecra e volta
// atras se o servidor recusar.
export function useAreaInterest(areaId: string) {
  const [rating, setRating] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAreaInterests()
      .then((rows) => {
        if (!cancelled) setRating(rows.find((row) => row.areaId === areaId)?.rating ?? null);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [areaId]);

  const change = useCallback(
    async (next: number | null) => {
      const previous = rating;
      setRating(next);
      setError(false);
      try {
        if (next === null) await clearAreaInterest(areaId);
        else await setAreaInterest(areaId, next);
      } catch {
        setRating(previous);
        setError(true);
      }
    },
    [areaId, rating],
  );

  return { rating, isLoading, error, change };
}
