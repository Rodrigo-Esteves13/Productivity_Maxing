import { FULL_PERCENT } from './percent';
import { MINUTES_PER_HOUR, MS_PER_DAY } from './timeConstants';
import type { EctsWorkloadCourse } from '../types/models';

// Carga de trabalho ECTS: horas reais (aulas + estudo) por cadeira contra as
// horas esperadas ate hoje. Funcoes puras, sem React nem storage.

// Horas de trabalho por credito (valor de referencia comum: 25 a 30).
export const MIN_HOURS_PER_CREDIT = 25;
export const MAX_HOURS_PER_CREDIT = 30;
export const DEFAULT_HOURS_PER_CREDIT = 27;

// Racio real / esperado ate hoje.
export const BELOW_EXPECTED_RATIO = 0.75;
export const ABOVE_EXPECTED_RATIO = 1.25;

// Com menos desta fracao do periodo decorrida a amostra e pequena demais.
export const MIN_ELAPSED_FRACTION = 0.1;

export type WorkloadStatus = 'below' | 'onTrack' | 'above' | 'early';

export interface WorkloadRow {
  areaId: string;
  name: string;
  credits: number;
  classHours: number;
  studyHours: number;
  realHours: number;
  expectedFullHours: number;
  // null quando o periodo nao tem fim (sem escala temporal).
  expectedSoFarHours: number | null;
  // real / esperado ate hoje; null sem escala ou com esperado a zero.
  ratio: number | null;
  // null sem escala temporal (so se mostram as horas reais).
  status: WorkloadStatus | null;
}

export interface WorkloadTotals {
  classHours: number;
  studyHours: number;
  realHours: number;
  expectedFullHours: number;
  expectedSoFarHours: number | null;
  ratio: number | null;
  status: WorkloadStatus | null;
}

export interface EctsWorkloadResult {
  rows: WorkloadRow[];
  totals: WorkloadTotals;
}

export function clampHoursPerCredit(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_HOURS_PER_CREDIT;
  return Math.min(MAX_HOURS_PER_CREDIT, Math.max(MIN_HOURS_PER_CREDIT, Math.round(value)));
}

/**
 * Valor guardado das horas por credito -> numero valido. Vazio, so espacos,
 * NaN ou ausente dao o default (Number('') seria 0 e viraria o minimo).
 */
export function parseStoredHoursPerCredit(raw: string | null): number {
  if (raw === null || raw.trim() === '') return DEFAULT_HOURS_PER_CREDIT;
  return clampHoursPerCredit(Number(raw));
}

export type ElapsedResult =
  | { kind: 'ok'; fraction: number }
  | { kind: 'noEnd' }
  | { kind: 'notStarted' }
  | { kind: 'invalid' };

function dayStartMs(isoDate: string): number {
  return Date.parse(isoDate.slice(0, 10));
}

/**
 * Fracao (0..1) do periodo ja decorrida, com o motivo quando nao ha escala.
 * Datas ISO (so conta o dia). O dia de fim e inclusivo: o fim efetivo e o
 * inicio do dia seguinte.
 */
export function elapsedFraction(startDate: string, endDate: string | null, nowMs: number): ElapsedResult {
  const startMs = dayStartMs(startDate);
  if (!Number.isFinite(startMs)) return { kind: 'invalid' };
  const endDayMs = endDate === null ? null : dayStartMs(endDate);
  if (endDayMs !== null && (!Number.isFinite(endDayMs) || endDayMs <= startMs)) return { kind: 'invalid' };
  if (nowMs < startMs) return { kind: 'notStarted' };
  if (endDayMs === null) return { kind: 'noEnd' };
  const endExclusiveMs = endDayMs + MS_PER_DAY;
  return { kind: 'ok', fraction: Math.min(1, Math.max(0, (nowMs - startMs) / (endExclusiveMs - startMs))) };
}

export interface BarSegments {
  classPct: number;
  studyPct: number;
  expectedPct: number | null;
}

/**
 * Larguras (% da barra inteira) dos segmentos. A escala e o maior entre real
 * e esperado ate hoje, por isso 50% do esperado ocupa 50% da barra.
 */
export function barSegments(classHours: number, studyHours: number, expectedSoFarHours: number | null): BarSegments {
  const scale = Math.max(classHours + studyHours, expectedSoFarHours ?? 0);
  const pct = (hours: number) => (scale > 0 ? (hours / scale) * FULL_PERCENT : 0);
  return {
    classPct: pct(classHours),
    studyPct: pct(studyHours),
    expectedPct: expectedSoFarHours === null ? null : pct(expectedSoFarHours),
  };
}

export function workloadStatus(ratio: number, fraction: number): WorkloadStatus {
  if (fraction < MIN_ELAPSED_FRACTION) return 'early';
  if (ratio < BELOW_EXPECTED_RATIO) return 'below';
  return ratio > ABOVE_EXPECTED_RATIO ? 'above' : 'onTrack';
}

function minutesToHours(minutes: number): number {
  return Math.max(0, minutes) / MINUTES_PER_HOUR;
}

function buildMetrics(expectedFullHours: number, realHours: number, fraction: number | null) {
  if (fraction === null) {
    return { expectedSoFarHours: null, ratio: null, status: null as WorkloadStatus | null };
  }
  const expectedSoFarHours = expectedFullHours * fraction;
  const ratio = expectedSoFarHours > 0 ? realHours / expectedSoFarHours : null;
  // Sem esperado ainda (fracao 0) conta como "cedo".
  const status: WorkloadStatus = ratio === null ? 'early' : workloadStatus(ratio, fraction);
  return { expectedSoFarHours, ratio, status };
}

/** Linhas por cadeira (so com creditos) ordenadas por racio ascendente, e totais. */
export function computeEctsWorkload(
  courses: readonly EctsWorkloadCourse[],
  hoursPerCredit: number,
  fraction: number | null,
): EctsWorkloadResult {
  const rows: WorkloadRow[] = courses
    .filter((course) => course.credits > 0)
    .map((course) => {
      const classHours = minutesToHours(course.classMinutes);
      const studyHours = minutesToHours(course.studyMinutes);
      const realHours = classHours + studyHours;
      const expectedFullHours = course.credits * hoursPerCredit;
      return {
        areaId: course.areaId,
        name: course.name,
        credits: course.credits,
        classHours,
        studyHours,
        realHours,
        expectedFullHours,
        ...buildMetrics(expectedFullHours, realHours, fraction),
      };
    })
    .sort((a, b) => {
      if (a.ratio === null && b.ratio === null) return a.name.localeCompare(b.name);
      if (a.ratio === null) return 1;
      if (b.ratio === null) return -1;
      return a.ratio - b.ratio || a.name.localeCompare(b.name);
    });

  const classHours = rows.reduce((sum, row) => sum + row.classHours, 0);
  const studyHours = rows.reduce((sum, row) => sum + row.studyHours, 0);
  const realHours = classHours + studyHours;
  const expectedFullHours = rows.reduce((sum, row) => sum + row.expectedFullHours, 0);
  return {
    rows,
    totals: { classHours, studyHours, realHours, expectedFullHours, ...buildMetrics(expectedFullHours, realHours, fraction) },
  };
}
