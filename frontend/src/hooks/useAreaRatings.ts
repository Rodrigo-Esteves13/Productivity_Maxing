import { useCallback, useEffect, useRef, useState } from 'react';
import { getAreaRatings, setAreaRating } from '../api/areaRatingsService';
import { createLatestWinsQueue } from '../lib/latestWinsQueue';
import { RATING_DOMAINS } from '../lib/domainEvents';
import * as bus from '../lib/bus';
import { useDomainKey } from './useDomainVersion';
import type { AreaRatingField } from '../types/models';

type Values = Record<AreaRatingField, number | null>;
const EMPTY: Values = { teacherRating: null, courseLiking: null };

// Escritas em fila por areaId+campo: so o ultimo valor chega ao servidor.
const enqueueWrite = createLatestWinsQueue();

type RatingRows = Awaited<ReturnType<typeof getAreaRatings>>;

// Um aviso de mudanca chega a todos os cartoes montados ao mesmo tempo: um
// so GET partilhado por aviso em vez de um por cartao. Um aviso novo pede
// sempre um GET novo (o anterior pode ja nao ter a ultima copia).
let changedRefetch: { change: object; rows: Promise<RatingRows> } | null = null;
function refetchAfterChange(change: object): Promise<RatingRows> {
  if (changedRefetch?.change === change) return changedRefetch.rows;
  const rows = getAreaRatings();
  const entry = { change, rows };
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

  // Outra cadeira mudou a nota do docente: o servidor pode te-la copiado para
  // esta, por isso volta a ler.
  useEffect(() => {
    let active = true;
    const unsubscribe = bus.on('areaRatings:teacherChanged', (change) => {
      if (change.areaId === areaId) return;
      // Escrita deste cartao ainda a caminho: a leitura podia trazer o valor
      // antigo e pisar o que a pessoa acabou de escolher.
      if (pendingWritesRef.current > 0) return;
      refetchAfterChange(change)
        .then((rows) => {
          if (!active || pendingWritesRef.current > 0) return;
          const row = rows.find((r) => r.areaId === areaId);
          const teacherRating = row?.teacherRating ?? null;
          valuesRef.current = { ...valuesRef.current, teacherRating };
          confirmedRef.current = { ...confirmedRef.current, teacherRating };
          setValues(valuesRef.current);
        })
        .catch(() => undefined);
    });
    return () => {
      active = false;
      unsubscribe();
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
            bus.emit('areaRatings:teacherChanged', { areaId });
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
  // A primeira avaliacao dada noutro cartao faz o resumo aparecer sem F5.
  const ratingsKey = useDomainKey(RATING_DOMAINS);
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
  }, [ratingsKey]);
  return state;
}
