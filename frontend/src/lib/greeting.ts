import { MS_PER_DAY } from './timeConstants';

// Saudacao do Dashboard + frase motivacional do dia. Tudo puro: o texto vem
// de chaves i18n (namespace "greeting"), aqui so se escolhe QUAL chave.

export const GREETING_CUSTOM_MAX_LENGTH = 60;
// Quantas variantes de texto existem por situacao (greeting.motivation.<situacao>.<n>).
export const MOTIVATION_VARIANT_COUNT = 4;
const MORNING_START_HOUR = 5;
const AFTERNOON_START_HOUR = 12;
const EVENING_START_HOUR = 18;
const NIGHT_START_HOUR = 22;
const DAYS_PER_WEEK = 7;
const MONDAY = 1;
const SUNDAY = 0;
// Atrasadas a partir das quais a frase passa a falar delas.
export const OVERDUE_NUDGE_THRESHOLD = 1;
// Multiplicador do hash de string.
const HASH_MULTIPLIER = 31;

export type DayPeriod = 'morning' | 'afternoon' | 'evening' | 'night';

export type MotivationSituation = 'overdue' | 'improving' | 'steady' | 'declining' | 'started' | 'fresh';

export interface ProgressSignals {
  doneThisWeek: number;
  doneLastWeek: number;
  overdueCount: number;
}

export interface MotivationPick {
  key: string;
  params: { count: number };
}

interface TaskLike {
  progressStatus?: string;
  completedAt?: string | null;
}

export function dayPeriodForHour(hour: number): DayPeriod {
  if (hour >= NIGHT_START_HOUR || hour < MORNING_START_HOUR) return 'night';
  if (hour >= EVENING_START_HOUR) return 'evening';
  if (hour >= AFTERNOON_START_HOUR) return 'afternoon';
  return 'morning';
}

// Inteiro estavel e nao negativo a partir de uma chave de dia ("YYYY-MM-DD").
export function daySeed(dayKey: string): number {
  let hash = 0;
  for (let i = 0; i < dayKey.length; i += 1) {
    hash = (hash * HASH_MULTIPLIER + dayKey.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function pickVariantIndex(seed: number, variantCount: number): number {
  if (variantCount <= 0) return 0;
  return seed % variantCount;
}

// Segunda-feira 00:00 (hora local) da semana de `now`.
function localWeekStart(now: Date): Date {
  const day = now.getDay();
  const back = day === SUNDAY ? DAYS_PER_WEEK - MONDAY : day - MONDAY;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
}

export function computeProgressSignals(
  tasks: readonly TaskLike[],
  now: Date,
  overdueCount: number,
): ProgressSignals {
  const thisWeekStart = localWeekStart(now).getTime();
  const lastWeekStart = thisWeekStart - DAYS_PER_WEEK * MS_PER_DAY;
  let doneThisWeek = 0;
  let doneLastWeek = 0;
  for (const task of tasks) {
    if (task.progressStatus !== 'COMPLETED' || !task.completedAt) continue;
    const completed = new Date(task.completedAt).getTime();
    if (Number.isNaN(completed)) continue;
    if (completed >= thisWeekStart) doneThisWeek += 1;
    else if (completed >= lastWeekStart) doneLastWeek += 1;
  }
  return { doneThisWeek, doneLastWeek, overdueCount };
}

export function pickSituation(signals: ProgressSignals): MotivationSituation {
  const { doneThisWeek, doneLastWeek, overdueCount } = signals;
  if (overdueCount >= OVERDUE_NUDGE_THRESHOLD) return 'overdue';
  if (doneThisWeek === 0 && doneLastWeek === 0) return 'fresh';
  if (doneThisWeek === 0) return 'started';
  if (doneThisWeek > doneLastWeek) return 'improving';
  if (doneThisWeek < doneLastWeek) return 'declining';
  return 'steady';
}

// Uma frase por dia: a mesma chave ate a situacao mudar ou o dia virar.
export function pickMotivation(signals: ProgressSignals, dayKey: string): MotivationPick {
  const situation = pickSituation(signals);
  const variant = pickVariantIndex(daySeed(dayKey), MOTIVATION_VARIANT_COUNT);
  const count = situation === 'overdue' ? signals.overdueCount : signals.doneThisWeek;
  return { key: `greeting.motivation.${situation}.${variant}`, params: { count } };
}

export function clampCustomGreeting(value: string): string {
  return value.slice(0, GREETING_CUSTOM_MAX_LENGTH);
}
