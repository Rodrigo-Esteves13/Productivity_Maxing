import { isUtcMidnight, toDateKey } from './dateKey';
// Datas de semana partilhadas (horário, turnos, copiar semana). Tudo em UTC:
// ver o comentário histórico em useSchedule.ts sobre o bug do dia errado.

const DAYS_PER_WEEK = 7;
const SUNDAY = 0;
const DAYS_FROM_MONDAY_TO_SUNDAY = 6;

/** Meia-noite UTC do dia que a pessoa vê no relógio dela. */
export function todayUtcAnchored(now: Date = new Date()): Date {
  // Única leitura local permitida: saber "que dia é hoje" para esta pessoa.
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export function addUtcDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/**
 * Nova data de uma task movida para amanha ("+1 Day" e swipe). Uma task sem
 * hora (meia-noite UTC) continua sem hora: meia-noite UTC de amanha. Uma com
 * hora fica amanha (dia local) a mesma hora local. Antes usava a meia-noite
 * LOCAL, que em Lisboa no verao e 23:00 UTC do dia anterior: a task ganhava
 * a hora 00:00 e algumas vistas punham-na hoje (B-09).
 */
export function tomorrowForTask(taskDate: Date, now: Date = new Date()): Date {
  if (isUtcMidnight(taskDate)) return addUtcDays(todayUtcAnchored(now), 1);
  const result = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  result.setHours(taskDate.getHours(), taskDate.getMinutes(), taskDate.getSeconds(), taskDate.getMilliseconds());
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
