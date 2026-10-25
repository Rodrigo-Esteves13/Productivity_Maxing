import { Difficulty, Effort } from '@prisma/client';
import {
  CALIBRATION_VISIBLE_DELTA,
  DEFAULT_MINUTES_GRADED,
  DEFAULT_MINUTES_UNGRADED,
  EFFORT_MULTIPLIER,
  MAX_TASK_MINUTES,
  MIN_REMAINING_WHEN_OVER_ESTIMATE,
  MIN_TASK_MINUTES,
} from './study-plan.constants';
import type { EstimateSource } from './study-plan.types';
import { clamp } from './study-plan.scheduler';

export interface EstimateInput {
  manualMinutes: number | null;
  predictedMinutes: number | null;
  // Média real das tuas tasks concluídas desta cadeira (mesmo tipo de
  // peso: com nota ou sem nota). null sem histórico.
  courseHistoryMinutes: number | null;
  difficulty: Difficulty;
  // null = MODERATE (sem escala).
  effort: Effort | null;
  isGraded: boolean;
}

export interface ResolvedEstimate {
  minutes: number;
  source: EstimateSource;
}

type EstimateStrategy = (
  input: EstimateInput,
  calibrationFactor: number | null,
) => ResolvedEstimate | null;

const fromManual: EstimateStrategy = (input, calibrationFactor) => {
  if (!input.manualMinutes || input.manualMinutes <= 0) return null;

  const factor = calibrationFactor ?? 1;
  const isCalibrated = Math.abs(factor - 1) >= CALIBRATION_VISIBLE_DELTA;
  return {
    minutes: input.manualMinutes * (isCalibrated ? factor : 1),
    source: isCalibrated ? 'manual_calibrated' : 'manual',
  };
};

const fromPrediction: EstimateStrategy = (input) =>
  input.predictedMinutes && input.predictedMinutes > 0
    ? { minutes: input.predictedMinutes, source: 'predicted' }
    : null;

const fromCourseHistory: EstimateStrategy = (input) =>
  input.courseHistoryMinutes && input.courseHistoryMinutes > 0
    ? { minutes: input.courseHistoryMinutes, source: 'course_history' }
    : null;

const fromDifficulty: EstimateStrategy = (input) => {
  const table = input.isGraded
    ? DEFAULT_MINUTES_GRADED
    : DEFAULT_MINUTES_UNGRADED;
  return { minutes: table[input.difficulty], source: 'default' };
};

// Ordem = confiança: o que o utilizador escreveu (ajustado pelo seu
// histórico), depois o modelo treinado nas suas sessões, depois a média
// do que ele já gastou nesta cadeira, e só por fim o palpite genérico.
const STRATEGIES: EstimateStrategy[] = [
  fromManual,
  fromPrediction,
  fromCourseHistory,
  fromDifficulty,
];

// O que o user escreveu ja tem em conta o trabalho que a task da; so os
// palpites (modelo, historico da cadeira, tabela) levam a escala do esforco.
const USER_WRITTEN_SOURCES: ReadonlySet<EstimateSource> = new Set([
  'manual',
  'manual_calibrated',
]);

export function resolveEstimate(
  input: EstimateInput,
  calibrationFactor: number | null,
): ResolvedEstimate {
  const effortScale = input.effort ? EFFORT_MULTIPLIER[input.effort] : 1;
  for (const strategy of STRATEGIES) {
    const resolved = strategy(input, calibrationFactor);
    if (resolved) {
      const scale = USER_WRITTEN_SOURCES.has(resolved.source) ? 1 : effortScale;
      return {
        minutes: Math.round(
          clamp(resolved.minutes * scale, MIN_TASK_MINUTES, MAX_TASK_MINUTES),
        ),
        source: resolved.source,
      };
    }
  }
  // Inalcançável (fromDifficulty devolve sempre), mas mantém o tipo fechado.
  return { minutes: MIN_TASK_MINUTES, source: 'default' };
}

/** Tempo que ainda falta estudar, dado o já registado nas sessões. */
export function computeNeededMinutes(
  estimateMinutes: number,
  loggedMinutes: number,
): number {
  const remaining = estimateMinutes - loggedMinutes;
  return remaining > 0 ? remaining : MIN_REMAINING_WHEN_OVER_ESTIMATE;
}
