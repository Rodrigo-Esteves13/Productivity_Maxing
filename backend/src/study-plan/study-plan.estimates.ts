import { Difficulty } from '@prisma/client';
import {
  CALIBRATION_VISIBLE_DELTA,
  DEFAULT_MINUTES_GRADED,
  DEFAULT_MINUTES_UNGRADED,
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

export function resolveEstimate(
  input: EstimateInput,
  calibrationFactor: number | null,
): ResolvedEstimate {
  for (const strategy of STRATEGIES) {
    const resolved = strategy(input, calibrationFactor);
    if (resolved) {
      return {
        minutes: Math.round(
          clamp(resolved.minutes, MIN_TASK_MINUTES, MAX_TASK_MINUTES),
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
