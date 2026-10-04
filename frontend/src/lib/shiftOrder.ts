import { toDateKey } from './dateKey';
import { addUtcDays } from './weekDates';
import type { WorkShift } from '../types/models';

const DAYS_PER_WEEK = 7;

// Turno a que ainda falta acontecer (ou acontece hoje) com a data da
// proxima ocorrencia, ou null se for pontual e ja passou.
export interface ShiftWithNextDate {
  shift: WorkShift;
  nextDate: string | null;
}

function nextOccurrenceKey(shift: WorkShift, today: Date): string | null {
  if (shift.dayOfWeek !== null) {
    const daysAhead = (shift.dayOfWeek - today.getUTCDay() + DAYS_PER_WEEK) % DAYS_PER_WEEK;
    return toDateKey(addUtcDays(today, daysAhead));
  }
  const key = shift.date?.slice(0, 10) ?? null;
  if (key === null) return null;
  return key >= toDateKey(today) ? key : null;
}

export interface OrderedShifts {
  // Por ordem de ocorrencia: o que acontece primeiro vem primeiro.
  upcoming: WorkShift[];
  // Pontuais que ja passaram, do mais recente para o mais antigo.
  past: WorkShift[];
}

/**
 * Ordena turnos pela proxima vez que acontecem (e depois pela hora) em vez
 * de pela ordem em que foram criados, e separa os pontuais ja passados.
 * `today` e meia-noite UTC do dia da pessoa (ver todayUtcAnchored).
 */
export function orderShiftsByOccurrence(shifts: WorkShift[], today: Date): OrderedShifts {
  const withDates: ShiftWithNextDate[] = shifts.map((shift) => ({
    shift,
    nextDate: nextOccurrenceKey(shift, today),
  }));

  const upcoming = withDates
    .filter((item): item is ShiftWithNextDate & { nextDate: string } => item.nextDate !== null)
    .sort(
      (a, b) =>
        a.nextDate.localeCompare(b.nextDate) || a.shift.startMinutes - b.shift.startMinutes,
    )
    .map((item) => item.shift);

  const past = withDates
    .filter((item) => item.nextDate === null)
    .map((item) => item.shift)
    .sort(
      (a, b) =>
        (b.date ?? '').localeCompare(a.date ?? '') || b.startMinutes - a.startMinutes,
    );

  return { upcoming, past };
}
