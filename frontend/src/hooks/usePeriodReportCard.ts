import { useCallback } from 'react';
import { getPeriodReportCard } from '../api/academicService';
import type { PeriodReportCard } from '../types/models';
import { useLoadOnce } from './useLoadOnce';

const NO_PERIOD = async (): Promise<PeriodReportCard | null> => null;

// Boletim do periodo escolhido. Sem periodo (ainda a carregar o contexto)
// nao pede nada.
export function usePeriodReportCard(periodId: string | null) {
  const fetcher = useCallback(
    () => (periodId ? getPeriodReportCard(periodId) : NO_PERIOD()),
    [periodId],
  );
  const { data, isLoading, error } = useLoadOnce(fetcher);
  return { card: data, isLoading, error };
}
