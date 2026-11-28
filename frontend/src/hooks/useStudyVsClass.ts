import { useCallback } from 'react';
import { getStudyVsClass } from '../api/scheduleService';
import type { StudyVsClass } from '../types/models';
import { useActivePeriodRange } from './useActivePeriodRange';
import { useFetch } from './useFetch';

interface StudyVsClassState {
  data: StudyVsClass | null;
  isLoading: boolean;
  hasError: boolean;
}

// Estudo por cadeira vs aulas dadas no periodo ativo. refreshKey muda quando
// se importa o horario.
export function useStudyVsClass(refreshKey: number): StudyVsClassState {
  const { from, to } = useActivePeriodRange();
  const fetcher = useCallback((signal: AbortSignal) => getStudyVsClass(from, to, signal), [from, to]);
  const { data, isLoading, hasError } = useFetch(fetcher, { refreshKey, clearDataOnError: true });

  return { data, isLoading, hasError };
}
