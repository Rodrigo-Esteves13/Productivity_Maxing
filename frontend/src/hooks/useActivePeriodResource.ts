import { useCallback, useEffect, useRef, useState } from 'react';
import { isRequestCanceled } from '../lib/abortable';
import { useAcademic } from '../context/useAcademic';
import type { DataDomain } from '../lib/domainEvents';
import { useDomainKey } from './useDomainVersion';

interface ActivePeriodOptions {
  // Dominios que, ao mudar noutro sitio da app, refazem o pedido em silencio.
  // Constante de modulo.
  domains: readonly DataDomain[];
  // Parametros do fetcher alem do periodo: se mudarem, mostra "a carregar".
  variant?: string;
}

// Recurso do periodo ativo (todos na vista agregada, periodId undefined) que
// recarrega quando ele muda (F-27). Um erro devolve hasError e retry. Sem
// programa ou periodo (carregamento academico ja terminou) nao ha o que
// pedir: devolve needsPeriod, um estado vazio proprio (data null sem erro).
// `fetcher` tem de ser estavel.
export function useActivePeriodResource<T>(
  fetcher: (periodId: string | undefined, signal: AbortSignal) => Promise<T>,
  { domains, variant = '' }: ActivePeriodOptions,
) {
  const { activePeriod, isViewingAllPeriods, isViewingAllPrograms, isLoading: isAcademicLoading } = useAcademic();
  const periodId = isViewingAllPeriods || isViewingAllPrograms ? undefined : activePeriod?.id;
  const needsPeriod = !isAcademicLoading && !isViewingAllPeriods && !isViewingAllPrograms && !activePeriod;
  const isWaitingForPeriod = isAcademicLoading || needsPeriod;
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const dataKey = useDomainKey(domains);
  // Pedido cujos dados estao no ecra: so mostra "a carregar" se mudar.
  const loadedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (needsPeriod) {
      loadedForRef.current = null;
      setData(null);
      setHasError(false);
      setIsLoading(false);
      return;
    }
    if (isWaitingForPeriod) return;
    const controller = new AbortController();
    const loadKey = `${variant}|${periodId ?? ''}`;
    if (loadedForRef.current !== loadKey) setIsLoading(true);
    fetcher(periodId, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        loadedForRef.current = loadKey;
        setData(result);
        setHasError(false);
        setIsLoading(false);
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted || isRequestCanceled(caught)) return;
        setHasError(true);
        setIsLoading(false);
      });
    return () => controller.abort();
  }, [fetcher, variant, periodId, isWaitingForPeriod, needsPeriod, attempt, dataKey]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { data, isLoading, hasError, needsPeriod, retry };
}
