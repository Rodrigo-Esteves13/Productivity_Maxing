import { formatClock, formatDayLabel, weekdayLabel } from '../../../lib/timeFormat';
import type { WorkShift } from '../../../types/models';
import { translateNow } from '../../../i18n/translate';
import { todayKey } from '../../../lib/dateKey';

export { weekdayLabel };

// Segunda primeiro (como a WeekGrid), mas o valor é o dayOfWeek do JS (0=Dom).

export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0].map((value) => ({
  value,
  get label() {
    return weekdayLabel(value);
  },
}));

// "Sat, Sun" a partir dos valores 0-6, na ordem Seg..Dom.
export function describeDaysOff(daysOff: readonly number[]): string {
  return WEEKDAYS.filter((d) => daysOff.includes(d.value))
    .map((d) => d.label)
    .join(', ');
}

export function describeShift(shift: WorkShift): string {
  const when =
    shift.dayOfWeek !== null
      ? translateNow('shift.everyWeekday', { day: weekdayLabel(shift.dayOfWeek) })
      : shift.date
        ? formatDayLabel(shift.date.slice(0, 10))
        : '';
  const time = `${formatClock(shift.startMinutes)}-${formatClock(shift.endMinutes)}`;
  // So vale a pena dizer quando comeca se ainda nao comecou.
  const startsKey = shift.dayOfWeek !== null && shift.startsOn ? shift.startsOn.slice(0, 10) : null;
  return startsKey && startsKey > todayKey()
    ? `${when} · ${time} · ${translateNow('shift.startsOnLine', { date: formatDayLabel(startsKey) })}`
    : `${when} · ${time}`;
}
