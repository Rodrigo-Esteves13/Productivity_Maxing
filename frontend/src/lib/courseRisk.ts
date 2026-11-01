import type { CourseRisk, CourseRiskOverviewRow, CourseRiskSummary, RiskLevel } from '../types/models';
import { formatNumber, formatPercent } from './ratings';

/** Funcao de traducao como a recebem os componentes de risco. */
export type RiskTranslate = (key: string, params?: Record<string, string | number>) => string;

/** Maximo de cadeiras listadas no cartao do dashboard (a pagina /risk mostra todas). */
export const DASHBOARD_RISK_ROWS_MAX = 5;

// Casas decimais do peso ja avaliado mostrado nas dicas.
const GRADED_WEIGHT_FRACTION_DIGITS = 1;
const GRADED_WEIGHT_SCALE = 10 ** GRADED_WEIGHT_FRACTION_DIGITS;
// Folga para o erro de virgula flutuante ao truncar (4.35 * 10 = 43.49999...).
const FLOOR_EPSILON = 1e-9;

// Casas decimais maximas dos numeros mostrados nas razoes (o motor ja arredonda).
const REASON_MAX_FRACTION_DIGITS = 2;

/**
 * Formata os params numericos de uma razao com o separador decimal do idioma
 * ativo (pt 17,7 / en 17.7). Textos (label, teacher) ficam como estao.
 */
export function formatReasonParams(
  params: Record<string, string | number>,
  lang: string,
): Record<string, string | number> {
  const formatter = new Intl.NumberFormat(lang, { maximumFractionDigits: REASON_MAX_FRACTION_DIGITS });
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => [key, typeof value === 'number' ? formatter.format(value) : value]),
  );
}

// Cor do selo e da barra por nivel (tabela em vez de if/else).
// Sem verde: o nivel baixo fica neutro.
export const RISK_LEVEL_STYLE: Record<RiskLevel, { badge: string; fill: string }> = {
  low: { badge: 'border-neutral-700 bg-neutral-800/60 text-neutral-300', fill: 'bg-neutral-500' },
  medium: { badge: 'border-violet-700 bg-violet-900/30 text-violet-200', fill: 'bg-violet-500' },
  high: { badge: 'border-red-800 bg-red-900/20 text-red-300', fill: 'bg-red-500/80' },
  extreme: { badge: 'border-red-700 bg-red-900/30 text-red-200', fill: 'bg-red-600' },
};

/** Linha com veredicto: risk e as probabilidades vem sempre preenchidos. */
export type AssessedRiskRow = CourseRiskOverviewRow & {
  risk: CourseRisk;
  passChancePct: number;
  failChancePct: number;
};

export function isAssessedRow(row: CourseRiskOverviewRow): row is AssessedRiskRow {
  return row.status === 'assessed' && row.risk !== null && row.passChancePct !== null && row.failChancePct !== null;
}

/** Separa as linhas mantendo a ordem do backend (assessed primeiro). */
export function splitOverviewRows(rows: CourseRiskOverviewRow[]): {
  assessed: AssessedRiskRow[];
  notEnoughData: CourseRiskOverviewRow[];
} {
  const assessed: AssessedRiskRow[] = [];
  const notEnoughData: CourseRiskOverviewRow[] = [];
  for (const row of rows) {
    if (isAssessedRow(row)) assessed.push(row);
    else notEnoughData.push(row);
  }
  return { assessed, notEnoughData };
}

/** Cartao em tom de perigo quando alguma cadeira esta em nivel high ou extreme. */
export function hasSeriousRisk(summary: CourseRiskSummary): boolean {
  return summary.highRiskCourses > 0;
}

const PERCENT_BASE = 100;

/** Percentagem inteira com o formato do idioma (72 -> "72%" / "72 %"). */
export function formatChancePct(value: number, lang: string): string {
  return formatPercent(value / PERCENT_BASE, lang);
}

/**
 * Peso ja avaliado (0 a 100) truncado a uma casa decimal, nunca arredondado
 * para cima: 9.6 fica "9.6" e nunca "10" ao lado de "precisa de pelo menos 10".
 */
export function formatGradedWeight(value: number, lang: string): string {
  const floored = Math.floor(value * GRADED_WEIGHT_SCALE + FLOOR_EPSILON) / GRADED_WEIGHT_SCALE;
  return formatNumber(floored, lang, GRADED_WEIGHT_FRACTION_DIGITS);
}

/** Confianca que merece rotulo: a alta nao precisa de aviso. */
export type NoticeableConfidence = 'low' | 'medium';

export function confidenceNotice(row: CourseRiskOverviewRow): NoticeableConfidence | null {
  return row.confidence === 'low' || row.confidence === 'medium' ? row.confidence : null;
}

/** Alguma cadeira avaliada e uma estimativa inicial (pouca nota lancada). */
export function hasLowConfidenceRow(rows: CourseRiskOverviewRow[]): boolean {
  return rows.some((row) => isAssessedRow(row) && row.confidence === 'low');
}

export type NeededSituation = 'value' | 'closed' | 'otherTrack';

/**
 * O que mostrar em "necessario no restante" quando o motor nao da valor:
 * sem peso por avaliar (fechado) ou o percurso continuo ja nao chega e conta
 * o exame/recurso.
 */
export function neededSituation(risk: CourseRisk): NeededSituation {
  if (risk.neededOnRemaining !== null) return 'value';
  return risk.track === 'CONTINUOUS' ? 'closed' : 'otherTrack';
}
