import type { CourseRisk } from '../approval-rules/approval-rules.types';
import {
  CONFIDENCE_HIGH_FROM_PCT,
  CONFIDENCE_MEDIUM_FROM_PCT,
} from './course-risk.constants';
import type { CourseRiskConfidence } from './course-risk-overview.types';

// Estimativa heuristica (simulada, nao uma previsao) da chance de passar a partir do
// score de risco (0..100) do motor. O score ja inclui o modelo pessimista do
// peso por avaliar (pass-probability.ts), com teto que desce com esse peso.
export const PASS_CHANCE_MIN_PCT = 0;
export const PASS_CHANCE_MAX_PCT = 100;
// Enquanto ainda ha peso por avaliar, nunca ha certeza (nem de passar nem de chumbar).
export const PASS_CHANCE_UNCERTAIN_MIN = 1;
export const PASS_CHANCE_UNCERTAIN_MAX = 99;

/**
 * 100 - score, arredondado a inteiro. Limitado a [0, 100] sem peso restante,
 * e a [1, 99] enquanto ha peso por avaliar e o chumbo nao esta decidido
 * (score 100).
 */
export function passChancePct(
  risk: Pick<CourseRisk, 'score' | 'remainingWeightPct'>,
): number {
  const raw = Math.round(PASS_CHANCE_MAX_PCT - risk.score);
  // Score maximo = chumbo decidido: nem com peso por avaliar ha chance minima.
  const open = risk.remainingWeightPct > 0 && risk.score < PASS_CHANCE_MAX_PCT;
  const min = open ? PASS_CHANCE_UNCERTAIN_MIN : PASS_CHANCE_MIN_PCT;
  const max = open ? PASS_CHANCE_UNCERTAIN_MAX : PASS_CHANCE_MAX_PCT;
  return Math.min(max, Math.max(min, raw));
}

/** Complemento da chance de passar. */
export function failChancePct(passChance: number): number {
  return PASS_CHANCE_MAX_PCT - passChance;
}

/** Confianca pela evidencia: peso ja avaliado (low < medium < high). */
export function confidenceFor(gradedWeightPct: number): CourseRiskConfidence {
  if (gradedWeightPct >= CONFIDENCE_HIGH_FROM_PCT) return 'high';
  if (gradedWeightPct >= CONFIDENCE_MEDIUM_FROM_PCT) return 'medium';
  return 'low';
}
