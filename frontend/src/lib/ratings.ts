import { MINUTES_PER_HOUR } from './timeConstants';
import type { RatingCorrelation, RatingCourseRow, RatingQuadrants, RatingStats } from '../types/models';

// |r| abaixo disto = sem relacao clara; os outros limiares separam fraca,
// moderada e forte (so servem de texto na UI).
const NO_RELATION_BELOW = 0.2;
const MODERATE_FROM = 0.4;
const STRONG_FROM = 0.6;

// Com poucas cadeiras um |r| alto e muitas vezes acaso: abaixo disto nao se
// usa nenhuma palavra de forca (so "sinal inicial" com r e n) e mostra-se um aviso.
export const STRONG_WORDING_MIN_N = 8;
// Menos cadeiras avaliadas que isto numa grelha: sem celula destacada.
export const QUADRANT_MIN_RATED = 3;

export type CorrelationId = keyof RatingStats['correlations'];
export type CorrelationStrength = 'none' | 'weak' | 'moderate' | 'strong';
export type CorrelationDirection = 'positive' | 'negative' | 'none';

export const CORRELATION_IDS: CorrelationId[] = [
  'teacherVsGrade',
  'courseVsGrade',
  'focusVsGrade',
  'courseVsFocus',
];

export type ReadyCorrelation = {
  kind: 'ready';
  direction: CorrelationDirection;
  strength: CorrelationStrength;
  /** Amostra pequena: a UI nao mostra palavra de forca. */
  small: boolean;
  r: number;
  n: number;
};
export type CorrelationReading =
  | { kind: 'insufficient'; n: number }
  | { kind: 'noVariation'; n: number }
  | ReadyCorrelation;

export function correlationStrength(r: number): CorrelationStrength {
  const abs = Math.abs(r);
  if (abs < NO_RELATION_BELOW) return 'none';
  if (abs < MODERATE_FROM) return 'weak';
  if (abs < STRONG_FROM) return 'moderate';
  return 'strong';
}

export function isSmallSample(n: number): boolean {
  return n < STRONG_WORDING_MIN_N;
}

export function readCorrelation(c: RatingCorrelation): CorrelationReading {
  if (c.enough && (c.reason === 'no_variation' || c.r === null)) return { kind: 'noVariation', n: c.n };
  if (!c.enough || c.r === null) return { kind: 'insufficient', n: c.n };
  const strength = correlationStrength(c.r);
  const direction: CorrelationDirection =
    strength === 'none' ? 'none' : c.r > 0 ? 'positive' : 'negative';
  return { kind: 'ready', direction, strength, small: isSmallSample(c.n), r: c.r, n: c.n };
}

/** Chave i18n da frase simples de uma correlacao. */
export function correlationSentenceKey(id: CorrelationId, direction: CorrelationDirection): string {
  return `ratings.corr.${id}.${direction}`;
}

/** Chave i18n do resumo do cartao: sinal inicial se a amostra e pequena, senao a ligacao mais forte. */
export function cardInsightKey(id: CorrelationId, direction: CorrelationDirection, n: number): string {
  return `ratings.card.${isSmallSample(n) ? 'early' : 'strongest'}.${id}.${direction}`;
}

/** A correlacao pronta e com relacao clara mais forte, ou null. */
export function strongestCorrelation(
  correlations: RatingStats['correlations'],
): { id: CorrelationId; reading: ReadyCorrelation } | null {
  let best: { id: CorrelationId; reading: ReadyCorrelation } | null = null;
  for (const id of CORRELATION_IDS) {
    const reading = readCorrelation(correlations[id]);
    if (reading.kind !== 'ready' || reading.direction === 'none') continue;
    if (!best || Math.abs(reading.r) > Math.abs(best.reading.r)) best = { id, reading };
  }
  return best;
}

/** Chave i18n da linha de metadados. Amostra pequena: sem palavra de forca. */
export function correlationMetaKey(reading: Pick<ReadyCorrelation, 'strength' | 'small'>): string {
  if (reading.small && reading.strength !== 'none') return 'ratings.corr.meta.small';
  return `ratings.corr.meta.${reading.strength}`;
}

export function quadrantTotal(q: RatingQuadrants): number {
  return q.likedGradeHigh + q.likedGradeLow + q.notLikedGradeHigh + q.notLikedGradeLow;
}

export function ratedCourseCount(courses: RatingCourseRow[]): number {
  return courses.filter((c) => c.teacherRating !== null || c.courseLiking !== null).length;
}

export function formatNumber(value: number, lang: string, fractionDigits = 1): string {
  return new Intl.NumberFormat(lang, { maximumFractionDigits: fractionDigits }).format(value);
}

export function formatPercent(fraction: number, lang: string): string {
  return new Intl.NumberFormat(lang, { style: 'percent', maximumFractionDigits: 0 }).format(fraction);
}

export function formatHours(minutes: number, lang: string): string {
  return formatNumber(minutes / MINUTES_PER_HOUR, lang, 1);
}
