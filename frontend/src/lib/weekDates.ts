import { toDateKey } from './dateKey';
// Datas de semana partilhadas (horário, turnos, copiar semana). Tudo em UTC:
// ver o comentário histórico em useSchedule.ts sobre o bug do dia errado.

const DAYS_PER_WEEK = 7;
const SUNDAY = 0;
const DAYS_FROM_MONDAY_TO_SUNDAY = 6;

/** Meia-noite UTC do dia que a pessoa vê no relógio dela. */
export function todayUtcAnchored(): Date {
  const now = new Date();
  // Única leitura local permitida: saber "que dia é hoje" para esta pessoa.
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export function addUtcDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/** Segunda-feira da semana de `date` (domingo conta para a semana anterior). */
export function startOfWeek(date: Date): Date {
  const day = date.getUTCDay();
  const diff = day === SUNDAY ? DAYS_FROM_MONDAY_TO_SUNDAY : day - 1;
  return addUtcDays(date, -diff);
}

export interface WeekOption {
  value: string;
  weeksFromNow: number;
}

/** Segundas-feiras de `count` semanas a partir de `firstOffset` semanas de hoje. */
export function weekStartKeys(firstOffset: number, count: number): WeekOption[] {
  const thisWeek = startOfWeek(todayUtcAnchored());
  return Array.from({ length: count }, (_, index) => {
    const weeksFromNow = firstOffset + index;
    return {
      value: toDateKey(addUtcDays(thisWeek, weeksFromNow * DAYS_PER_WEEK)),
      weeksFromNow,
    };
  });
}
