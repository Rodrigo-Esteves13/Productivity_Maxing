import { useEffect, useState } from 'react';
import { getAttendanceSummary } from '../api/scheduleService';
import { isRequestCanceled } from '../lib/abortable';
import type { SubjectAttendance } from '../types/models';
import { useActivePeriodRange } from './useActivePeriodRange';

interface AttendanceSummaryState {
  rows: SubjectAttendance[];
  isLoading: boolean;
  hasError: boolean;
}

// Presencas por disciplina no periodo ativo (o backend corta em hoje).
// refreshKey muda quando se marca uma presenca ou se importa o horario.
export function useAttendanceSummary(refreshKey: number): AttendanceSummaryState {
  const { from, to } = useActivePeriodRange();
  const [state, setState] = useState<AttendanceSummaryState>({ rows: [], isLoading: true, hasError: false });

  useEffect(() => {
    const controller = new AbortController();
    getAttendanceSummary(from, to, controller.signal)
      .then((rows) => setState({ rows, isLoading: false, hasError: false }))
      .catch((caught: unknown) => {
        if (isRequestCanceled(caught)) return;
        setState({ rows: [], isLoading: false, hasError: true });
      });
    return () => controller.abort();
  }, [from, to, refreshKey]);

  return state;
}
