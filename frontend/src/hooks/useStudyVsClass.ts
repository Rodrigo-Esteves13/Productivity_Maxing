import { useEffect, useState } from 'react';
import { getStudyVsClass } from '../api/scheduleService';
import { isRequestCanceled } from '../lib/abortable';
import type { StudyVsClass } from '../types/models';
import { useActivePeriodRange } from './useActivePeriodRange';

interface StudyVsClassState {
  data: StudyVsClass | null;
  isLoading: boolean;
  hasError: boolean;
}

// Estudo por cadeira vs aulas dadas no periodo ativo. refreshKey muda quando
// se importa o horario.
export function useStudyVsClass(refreshKey: number): StudyVsClassState {
  const { from, to } = useActivePeriodRange();
  const [state, setState] = useState<StudyVsClassState>({ data: null, isLoading: true, hasError: false });

  useEffect(() => {
    const controller = new AbortController();
    getStudyVsClass(from, to, controller.signal)
      .then((data) => setState({ data, isLoading: false, hasError: false }))
      .catch((caught: unknown) => {
        if (isRequestCanceled(caught)) return;
        setState({ data: null, isLoading: false, hasError: true });
      });
    return () => controller.abort();
  }, [from, to, refreshKey]);

  return state;
}
