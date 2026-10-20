import { useEffect, useState } from 'react';
import { getAttendanceSummary } from '../api/scheduleService';
import { useAcademic } from '../context/useAcademic';
import { isRequestCanceled } from '../lib/abortable';
import { toDateKey, todayKey } from '../lib/dateKey';
import { addUtcDays, todayUtcAnchored } from '../lib/weekDates';
import type { SubjectAttendance } from '../types/models';

// Sem periodo ativo (vista "todos os periodos"): ultimos ~6 meses.
const FALLBACK_DAYS = 183;

interface AttendanceSummaryState {
  rows: SubjectAttendance[];
  isLoading: boolean;
  hasError: boolean;
}

// Presencas por disciplina no periodo ativo (o backend corta em hoje).
// refreshKey muda quando se marca uma presenca ou se importa o horario.
export function useAttendanceSummary(refreshKey: number): AttendanceSummaryState {
  const { activePeriod } = useAcademic();
  const from = activePeriod
    ? activePeriod.startDate.slice(0, 10)
    : toDateKey(addUtcDays(todayUtcAnchored(), -FALLBACK_DAYS));
  const to = activePeriod?.endDate?.slice(0, 10) ?? todayKey();
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
