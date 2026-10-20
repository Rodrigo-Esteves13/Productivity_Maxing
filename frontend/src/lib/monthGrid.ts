import { addUtcDays, startOfWeek } from './weekDates';
import { toDateKey } from './dateKey';
// Grelha mensal do horario: semanas completas (segunda a domingo) que
// cobrem o mes todo. Tudo em UTC, mesma convencao de weekDates.ts.

const DAYS_PER_WEEK = 7;

export interface MonthGridDay {
  key: string; // YYYY-MM-DD
  date: Date;
  inMonth: boolean;
}

/** Dia 1 do mes de `date` (meia-noite UTC). */
export function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

/** Dia 1 do mes `months` meses depois (negativo = antes). */
export function addUtcMonths(monthStart: Date, months: number): Date {
  return new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + months, 1));
}

/**
 * Dias da grelha: da segunda-feira da semana do dia 1 ao domingo da semana
 * do ultimo dia. Da 4 a 6 semanas (fevereiro a comecar numa segunda tem 4).
 */
export function monthGridDays(monthStart: Date): MonthGridDay[] {
  const month = monthStart.getUTCMonth();
  const lastDay = addUtcDays(addUtcMonths(monthStart, 1), -1);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = addUtcDays(startOfWeek(lastDay), DAYS_PER_WEEK - 1);

  const days: MonthGridDay[] = [];
  for (let date = gridStart; date <= gridEnd; date = addUtcDays(date, 1)) {
    days.push({ key: toDateKey(date), date, inMonth: date.getUTCMonth() === month });
  }
  return days;
}
