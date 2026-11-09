import { FULL_PERCENT } from './percent';

// Desafio semanal auto-gerado: a meta vem da media das 3 ultimas semanas
// completas (+1 para puxar um pouco), so com tasks que o Dashboard ja tem.

export const WEEKLY_CHALLENGE_HISTORY_WEEKS = 3;
export const WEEKLY_CHALLENGE_MIN_TARGET = 3;
export const WEEKLY_CHALLENGE_MAX_TARGET = 15;
// Meta quando ainda nao ha historico.
export const WEEKLY_CHALLENGE_DEFAULT_TARGET = 5;
// Variantes de frase de incentivo por estado (weeklyChallenge.line.<estado>.<n>).
export const WEEKLY_CHALLENGE_LINE_VARIANTS = 3;
const TARGET_STRETCH = 1;
const DAYS_PER_WEEK = 7;
const MONDAY = 1;
const SUNDAY = 0;

export type WeeklyChallengeStatus = 'inProgress' | 'done' | 'noHistory';

export interface WeeklyChallenge {
  target: number;
  progress: number;
  percent: number;
  // Dias que faltam na semana, contando hoje (1 a 7).
  daysLeft: number;
  status: WeeklyChallengeStatus;
}

interface TaskLike {
  progressStatus?: string;
  completedAt?: string | null;
}

// Segunda-feira 00:00 (hora local) da semana de `now`, deslocada `weeksBack` semanas.
function localWeekStart(now: Date, weeksBack = 0): Date {
  const day = now.getDay();
  const back = day === SUNDAY ? DAYS_PER_WEEK - MONDAY : day - MONDAY;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - back - weeksBack * DAYS_PER_WEEK);
}

export function clampTarget(value: number): number {
  return Math.min(WEEKLY_CHALLENGE_MAX_TARGET, Math.max(WEEKLY_CHALLENGE_MIN_TARGET, value));
}

export function computeWeeklyChallenge(tasks: readonly TaskLike[], now: Date): WeeklyChallenge {
  const weekStart = localWeekStart(now).getTime();
  const historyStart = localWeekStart(now, WEEKLY_CHALLENGE_HISTORY_WEEKS).getTime();
  let progress = 0;
  let history = 0;
  for (const task of tasks) {
    if (task.progressStatus !== 'COMPLETED' || !task.completedAt) continue;
    const completed = new Date(task.completedAt).getTime();
    if (Number.isNaN(completed)) continue;
    if (completed >= weekStart) progress += 1;
    else if (completed >= historyStart) history += 1;
  }

  const hasHistory = history > 0;
  const target = hasHistory
    ? clampTarget(Math.round(history / WEEKLY_CHALLENGE_HISTORY_WEEKS) + TARGET_STRETCH)
    : WEEKLY_CHALLENGE_DEFAULT_TARGET;

  const day = now.getDay();
  const daysSinceMonday = day === SUNDAY ? DAYS_PER_WEEK - MONDAY : day - MONDAY;
  let status: WeeklyChallengeStatus = 'inProgress';
  if (progress >= target) status = 'done';
  else if (!hasHistory) status = 'noHistory';

  return {
    target,
    progress,
    percent: Math.min(FULL_PERCENT, (progress / target) * FULL_PERCENT),
    daysLeft: DAYS_PER_WEEK - daysSinceMonday,
    status,
  };
}
