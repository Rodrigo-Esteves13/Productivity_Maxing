import type { Difficulty, Task } from '../types/models';
import { wasCompletedOnTime } from '../utils/deadlineCompliance';

// Indicador divertido: nunca bloqueia nem decide nada na app.
export const XP_BASE_PER_TASK = 10;
export const XP_ON_TIME_BONUS = 5;

export const XP_DIFFICULTY_BONUS: Record<Difficulty, number> = {
  VERY_EASY: 0,
  EASY: 2,
  MEDIUM: 5,
  HARD: 8,
  VERY_HARD: 12,
};

// XP total necessario para chegar ao nivel n: BASE * n^EXPONENT.
export const XP_LEVEL_BASE = 40;
export const XP_LEVEL_EXPONENT = 1.5;
export const XP_FIRST_LEVEL = 1;
const PERCENT_MAX = 100;

export interface XpLevelResult {
  xp: number;
  level: number;
  xpIntoLevel: number;
  xpForNext: number;
  percent: number;
}

// Nivel 1 comeca em 0 XP; o nivel n+1 exige xpForLevel(n) no total.
export function xpForLevel(level: number): number {
  return Math.round(XP_LEVEL_BASE * Math.pow(Math.max(level, 0), XP_LEVEL_EXPONENT));
}

export function xpForTask(task: Task): number {
  if (task.progressStatus !== 'COMPLETED') return 0;
  const difficultyBonus = XP_DIFFICULTY_BONUS[task.difficulty] ?? 0;
  const onTimeBonus = wasCompletedOnTime(task) === true ? XP_ON_TIME_BONUS : 0;
  return XP_BASE_PER_TASK + difficultyBonus + onTimeBonus;
}

export function levelFromXp(xp: number): XpLevelResult {
  const safeXp = Math.max(0, Math.floor(xp));
  let level = XP_FIRST_LEVEL;
  while (safeXp >= xpForLevel(level)) level += 1;
  const floor = level === XP_FIRST_LEVEL ? 0 : xpForLevel(level - 1);
  const span = xpForLevel(level) - floor;
  const xpIntoLevel = safeXp - floor;
  return {
    xp: safeXp,
    level,
    xpIntoLevel,
    xpForNext: span,
    percent: span > 0 ? Math.round((xpIntoLevel / span) * PERCENT_MAX) : 0,
  };
}

export function computeXpLevel(tasks: Task[]): XpLevelResult {
  return levelFromXp(tasks.reduce((sum, task) => sum + xpForTask(task), 0));
}
