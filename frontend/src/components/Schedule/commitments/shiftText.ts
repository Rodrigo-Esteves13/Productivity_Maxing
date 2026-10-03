import { formatClock, formatDayLabel } from '../../../lib/timeFormat';
import type { WorkShift } from '../../../types/models';

// Segunda primeiro (como a WeekGrid), mas o valor é o dayOfWeek do JS (0=Dom).
export const WEEKDAYS = [
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
  { label: 'Sun', value: 0 },
] as const;

const WEEKDAY_LABEL: Record<number, string> = Object.fromEntries(
  WEEKDAYS.map((d) => [d.value, d.label]),
);

export function describeShift(shift: WorkShift): string {
  const when =
    shift.dayOfWeek !== null
      ? `Every ${WEEKDAY_LABEL[shift.dayOfWeek] ?? ''}`
      : shift.date
        ? formatDayLabel(shift.date.slice(0, 10))
        : '';
  return `${when} · ${formatClock(shift.startMinutes)}-${formatClock(shift.endMinutes)}`;
}
