import { useCallback, useEffect, useRef, useState } from 'react';
import { getAreaRatings, setAreaRating } from '../api/areaRatingsService';
import { createLatestWinsQueue } from '../lib/latestWinsQueue';
import type { AreaRatingField } from '../types/models';

type Values = Record<AreaRatingField, number | null>;
const EMPTY: Values = { teacherRating: null, courseLiking: null };

// Escritas em fila por areaId+campo: so o ultimo valor chega ao servidor.
const enqueueWrite = createLatestWinsQueue();

// Avaliacoes privadas (1 a 5) do docente e da cadeira. Atualiza logo no
// ecra e volta atras se o servidor recusar.
export function useAreaRatings(areaId: string) {
  const [values, setValues] = useState<Values>(EMPTY);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const valuesRef = useRef<Values>(EMPTY);
  // Ultimo valor confirmado pelo servidor, para onde se volta se a escrita falhar.
  const confirmedRef = useRef<Values>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(false);
    getAreaRatings()
      .then((rows) => {
        const row = rows.find((r) => r.areaId === areaId);
        if (!cancelled) {
          const loaded = row ? { teacherRating: row.teacherRating, courseLiking: row.courseLiking } : EMPTY;
          valuesRef.current = loaded;
          confirmedRef.current = loaded;
          setValues(loaded);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [areaId]);

  const change = useCallback(
    async (field: AreaRatingField, next: number | null) => {
      setError(false);
      valuesRef.current = { ...valuesRef.current, [field]: next };
      setValues(valuesRef.current);
      try {
        await enqueueWrite(`${areaId}:${field}`, async () => {
          await setAreaRating(areaId, field, next);
          confirmedRef.current = { ...confirmedRef.current, [field]: next };
        });
      } catch {
        // So volta atras se nenhuma alteracao mais recente tocou neste campo.
        if (valuesRef.current[field] === next) {
          valuesRef.current = { ...valuesRef.current, [field]: confirmedRef.current[field] };
          setValues(valuesRef.current);
        }
        setError(true);
      }
    },
    [areaId],
  );

  return { ...values, isLoading, error, loadError, change };
}

// Verificacao barata (GET /area-ratings) de que existe pelo menos uma
// avaliacao, para o Dashboard so pedir as estatisticas quando fazem sentido.
export function useHasAnyRating() {
  const [state, setState] = useState<{ isLoading: boolean; hasAny: boolean }>({ isLoading: true, hasAny: false });
  useEffect(() => {
    let cancelled = false;
    getAreaRatings()
      .then((rows) => {
        if (!cancelled) setState({ isLoading: false, hasAny: rows.some((r) => r.teacherRating !== null || r.courseLiking !== null) });
      })
      .catch(() => {
        if (!cancelled) setState({ isLoading: false, hasAny: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}
