import {
  DateCertainty,
  Difficulty,
  Effort,
  ProgressStatus,
} from '@prisma/client';
import { hasFirmDate } from '../common/task-readiness.util';

// Chaves do catalogo Priority (ver prisma/scripts/seed-priorities.ts). A
// sugestao nunca e aplicada sozinha: o user decide a prioridade.
export const SUGGESTED_PRIORITY = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
} as const;
export type SuggestedPriorityKey =
  (typeof SUGGESTED_PRIORITY)[keyof typeof SUGGESTED_PRIORITY];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Pontos por sinal; a soma decide o nivel (ver LEVEL_MIN_SCORE).
export const SUGGESTION_RULES = {
  // [ate N dias, pontos], do mais urgente para o menos; atrasada = primeiro.
  deadlineDays: [
    { maxDays: 2, points: 3 },
    { maxDays: 7, points: 2 },
    { maxDays: 14, points: 1 },
  ],
  // [a partir de N adiamentos, pontos], do maior para o menor.
  postponed: [
    { min: 3, points: 2 },
    { min: 1, points: 1 },
  ],
  // [a partir de N % da nota, pontos].
  weight: [
    { min: 30, points: 2 },
    { min: 15, points: 1 },
  ],
  difficultyPoints: {
    [Difficulty.VERY_EASY]: 0,
    [Difficulty.EASY]: 0,
    [Difficulty.MEDIUM]: 0,
    [Difficulty.HARD]: 1,
    [Difficulty.VERY_HARD]: 1,
  } as Record<Difficulty, number>,
  effortPoints: {
    [Effort.LIGHT]: 0,
    [Effort.MODERATE]: 0,
    [Effort.HEAVY]: 1,
    [Effort.EXHAUSTIVE]: 1,
  } as Record<Effort, number>,
} as const;

const LEVEL_MIN_SCORE: ReadonlyArray<{
  min: number;
  key: SuggestedPriorityKey;
}> = [
  { min: 6, key: SUGGESTED_PRIORITY.HIGH },
  { min: 3, key: SUGGESTED_PRIORITY.MEDIUM },
  { min: 0, key: SUGGESTED_PRIORITY.LOW },
];

export interface PrioritySuggestionInput {
  date: Date;
  dateCertainty: DateCertainty;
  progressStatus: ProgressStatus;
  postponedCount: number;
  weightPercentage: number | null;
  difficulty: Difficulty;
  effort: Effort | null;
}

export function scorePriority(
  task: PrioritySuggestionInput,
  now: Date,
): number {
  let score = 0;
  if (hasFirmDate(task.dateCertainty)) {
    const days = (task.date.getTime() - now.getTime()) / MS_PER_DAY;
    const rule = SUGGESTION_RULES.deadlineDays.find((r) => days <= r.maxDays);
    score += rule?.points ?? 0;
  }
  score +=
    SUGGESTION_RULES.postponed.find((r) => task.postponedCount >= r.min)
      ?.points ?? 0;
  score +=
    SUGGESTION_RULES.weight.find((r) => (task.weightPercentage ?? 0) >= r.min)
      ?.points ?? 0;
  score += SUGGESTION_RULES.difficultyPoints[task.difficulty] ?? 0;
  score += task.effort ? (SUGGESTION_RULES.effortPoints[task.effort] ?? 0) : 0;
  return score;
}

/**
 * Prioridade que o sistema preveria agora, so como sugestao. null quando a
 * task esta concluida (nao tem prioridade) ou quando ja coincide com a atual.
 */
export function suggestPriorityKey(
  task: PrioritySuggestionInput,
  currentKey: string | null,
  now: Date = new Date(),
): SuggestedPriorityKey | null {
  if (task.progressStatus === ProgressStatus.COMPLETED) return null;
  const score = scorePriority(task, now);
  const key = LEVEL_MIN_SCORE.find((l) => score >= l.min)!.key;
  return key === currentKey ? null : key;
}
