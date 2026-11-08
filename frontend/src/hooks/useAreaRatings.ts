import { useCallback, useEffect, useRef, useState } from 'react';
import { getAreaRatings, setAreaRating } from '../api/areaRatingsService';
import { createLatestWinsQueue } from '../lib/latestWinsQueue';
import type { AreaRatingField } from '../types/models';

type Values = Record<AreaRatingField, number | null>;
const EMPTY: Values = { teacherRating: null, courseLiking: null };

// O servidor copia a nota do docente para as outras cadeiras com o mesmo
// docente. Este evento faz os outros cartoes visiveis voltarem a ler.
const RATINGS_CHANGED_EVENT = 'pm-area-ratings-changed';

// Escritas em fila por areaId+campo: so o ultimo valor chega ao servidor.
const enqueueWrite = createLatestWinsQueue();

type RatingRows = Awaited<ReturnType<typeof getAreaRatings>>;

// Um evento de mudanca chega a todos os cartoes montados ao mesmo tempo: um
// so GET partilhado por evento em vez de um por cartao. Um evento novo pede
// sempre um GET novo (o anterior pode ja nao ter a ultima copia).
let changedRefetch: { event: Event; rows: Promise<RatingRows> } | null = null;
function refetchAfterChange(event: Event): Promise<RatingRows> {
  if (changedRefetch?.event === event) return changedRefetch.rows;
  const rows = getAreaRatings();
  const entry = { event, rows };
  changedRefetch = entry;
  const clear = () => {
    if (changedRefetch === entry) changedRefetch = null;
  };
  rows.then(clear, clear);
  return rows;
}

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
  // Escritas deste cartao ainda por confirmar.
  const pendingWritesRef = useRef(0);

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

  // Outra cadeira mudou a nota do docente: pode ter sido copiada para esta.
  useEffect(() => {
    let active = true;
    const onChanged = (event: Event) => {
      if ((event as CustomEvent<{ areaId: string }>).detail?.areaId === areaId) return;
      // Escrita deste cartao ainda a caminho: a leitura podia trazer o valor
      // antigo e pisar o que a pessoa acabou de escolher.
      if (pendingWritesRef.current > 0) return;
      refetchAfterChange(event)
        .then((rows) => {
          if (!active || pendingWritesRef.current > 0) return;
          const row = rows.find((r) => r.areaId === areaId);
          const teacherRating = row?.teacherRating ?? null;
          valuesRef.current = { ...valuesRef.current, teacherRating };
          confirmedRef.current = { ...confirmedRef.current, teacherRating };
          setValues(valuesRef.current);
        })
        .catch(() => undefined);
    };
    window.addEventListener(RATINGS_CHANGED_EVENT, onChanged);
    return () => {
      active = false;
      window.removeEventListener(RATINGS_CHANGED_EVENT, onChanged);
    };
  }, [areaId]);

  const change = useCallback(
    async (field: AreaRatingField, next: number | null) => {
      setError(false);
      valuesRef.current = { ...valuesRef.current, [field]: next };
      setValues(valuesRef.current);
      pendingWritesRef.current += 1;
      try {
        await enqueueWrite(`${areaId}:${field}`, async () => {
          await setAreaRating(areaId, field, next);
          confirmedRef.current = { ...confirmedRef.current, [field]: next };
          if (field === 'teacherRating') {
            window.dispatchEvent(new CustomEvent(RATINGS_CHANGED_EVENT, { detail: { areaId } }));
          }
        });
      } catch {
        // So volta atras se nenhuma alteracao mais recente tocou neste campo.
        if (valuesRef.current[field] === next) {
          valuesRef.current = { ...valuesRef.current, [field]: confirmedRef.current[field] };
          setValues(valuesRef.current);
        }
        setError(true);
      } finally {
        pendingWritesRef.current -= 1;
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
