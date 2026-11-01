import { roundTo } from '../common/round.util';
import type {
  ApprovalRules,
  CustomRule,
  CustomRuleKind,
} from './approval-rules.types';
import {
  CUSTOM_RULE_KINDS,
  CUSTOM_RULE_LABEL_MAX,
  CUSTOM_RULE_MAX_BELOW_LIMIT,
  CUSTOM_RULES_MAX,
} from './custom-rules.constants';

// Regras custom de aprovacao (somadas as duas fixas do motor). Puro: sem Nest
// nem Prisma, usado pelo motor de risco, pela probabilidade de passar e pelo
// servico (sanitizeCustomRules le a coluna Json).
//
// So se avaliam componentes JA avaliados (conservador): nao se simula o que
// os componentes futuros fariam a estas regras. Uma regra violada pelas notas
// ja tiradas decide a continua (como as regras fixas).
//
// MAX_BELOW: no maximo `maxBelow` componentes avaliados (filtrados por
//   labelContains) com nota < threshold.
// GROUP_AVG_MIN: media ponderada pelo peso (share) dos componentes avaliados
//   filtrados tem de ser >= threshold. So conta com pelo menos um componente
//   que encaixe no filtro.

/** Tolerancia de virgula flutuante, igual a do motor. */
const FLOAT_EPSILON = 1e-9;
/** Casas decimais do threshold (o DTO aceita 2). */
const THRESHOLD_DECIMALS = 2;

export interface CustomRuleComponent {
  label: string;
  grade: number;
  /** Fracao (0-1) do peso total da cadeira. */
  share: number;
}

export type CustomRuleViolation = {
  rule: CustomRule;
  /** MAX_BELOW: componentes abaixo do limiar. GROUP_AVG_MIN: componentes no grupo. */
  count: number;
  /** GROUP_AVG_MIN: media ponderada do grupo. MAX_BELOW: null. */
  average: number | null;
};

/** Sem acentos, minusculas, espacos colapsados: para comparar nomes. */
export function normalizeLabel(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesLabel(label: string, labelContains: string | null): boolean {
  if (labelContains === null) return true;
  const needle = normalizeLabel(labelContains);
  if (needle === '') return true;
  return normalizeLabel(label).includes(needle);
}

const isBelow = (grade: number, threshold: number): boolean =>
  grade < threshold - FLOAT_EPSILON;

/**
 * O DTO ja obriga a [scaleMin, scaleMax]; se a escala mudou depois, uma regra
 * fora dela ignora-se em vez de chumbar (ou passar) tudo sem sentido.
 */
const thresholdInScale = (threshold: number, rules: ApprovalRules): boolean =>
  Number.isFinite(threshold) &&
  threshold >= rules.scaleMin - FLOAT_EPSILON &&
  threshold <= rules.scaleMax + FLOAT_EPSILON;

type RuleEvaluator = (
  rule: CustomRule,
  matching: readonly CustomRuleComponent[],
) => CustomRuleViolation | null;

const EVALUATORS: Record<CustomRuleKind, RuleEvaluator> = {
  MAX_BELOW: (rule, matching) => {
    if (rule.maxBelow === null) return null;
    const count = matching.filter((c) =>
      isBelow(c.grade, rule.threshold),
    ).length;
    return count > rule.maxBelow ? { rule, count, average: null } : null;
  },
  GROUP_AVG_MIN: (rule, matching) => {
    if (matching.length === 0) return null;
    const totalShare = matching.reduce((acc, c) => acc + c.share, 0);
    // Sem peso nenhum (dados estranhos) cai para a media simples.
    const average =
      totalShare > FLOAT_EPSILON
        ? matching.reduce((acc, c) => acc + c.grade * c.share, 0) / totalShare
        : matching.reduce((acc, c) => acc + c.grade, 0) / matching.length;
    return isBelow(average, rule.threshold)
      ? { rule, count: matching.length, average }
      : null;
  },
};

/** Regras custom violadas pelos componentes ja avaliados. [] sem regras. */
export function evaluateCustomRules(
  components: readonly CustomRuleComponent[],
  rules: ApprovalRules,
): CustomRuleViolation[] {
  const customRules = rules.customRules ?? [];
  if (customRules.length === 0) return [];
  const graded = components.filter(
    (c) => Number.isFinite(c.grade) && Number.isFinite(c.share),
  );
  const violations: CustomRuleViolation[] = [];
  for (const rule of customRules) {
    const evaluate = EVALUATORS[rule.kind];
    if (!evaluate || !thresholdInScale(rule.threshold, rules)) continue;
    const matching = graded.filter((c) =>
      matchesLabel(c.label, rule.labelContains),
    );
    const violation = evaluate(rule, matching);
    if (violation) violations.push(violation);
  }
  return violations;
}

const formatNumber = (value: number): string =>
  String(roundTo(value, THRESHOLD_DECIMALS));

const DESCRIBERS: Record<CustomRuleKind, (rule: CustomRule) => string> = {
  MAX_BELOW: (rule) =>
    `max ${rule.maxBelow ?? 0} < ${formatNumber(rule.threshold)}`,
  GROUP_AVG_MIN: (rule) => `avg >= ${formatNumber(rule.threshold)}`,
};

/**
 * Texto curto e neutro da regra para os params da razao (a UI traduz a frase
 * a volta). Ex: `max 1 < 8 "teste"`, `avg >= 9.5`.
 */
export function describeCustomRule(rule: CustomRule): string {
  const describe = DESCRIBERS[rule.kind];
  const base = describe ? describe(rule) : rule.kind;
  return rule.labelContains ? `${base} "${rule.labelContains}"` : base;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isKind = (value: unknown): value is CustomRuleKind =>
  typeof value === 'string' &&
  (CUSTOM_RULE_KINDS as readonly string[]).includes(value);

function sanitizeLabel(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().slice(0, CUSTOM_RULE_LABEL_MAX).trim();
  return trimmed === '' ? null : trimmed;
}

function sanitizeMaxBelow(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value)) return undefined;
  if (value < 0 || value > CUSTOM_RULE_MAX_BELOW_LIMIT) return undefined;
  return value;
}

/** undefined = item invalido (descarta-se). */
function sanitizeRule(value: unknown): CustomRule | undefined {
  if (!isRecord(value)) return undefined;
  const { kind, threshold } = value;
  if (!isKind(kind)) return undefined;
  if (typeof threshold !== 'number' || !Number.isFinite(threshold)) {
    return undefined;
  }
  const labelContains = sanitizeLabel(value.labelContains);
  if (kind === 'GROUP_AVG_MIN') {
    return { kind, threshold, maxBelow: null, labelContains };
  }
  const maxBelow = sanitizeMaxBelow(value.maxBelow);
  if (maxBelow === undefined) return undefined;
  return { kind, threshold, maxBelow, labelContains };
}

/**
 * Le a coluna Json das regras custom com desconfianca: qualquer coisa que
 * nao seja um array da []; itens malformados sao descartados; no maximo
 * CUSTOM_RULES_MAX regras.
 */
export function sanitizeCustomRules(value: unknown): CustomRule[] {
  if (!Array.isArray(value)) return [];
  const rules: CustomRule[] = [];
  for (const item of value as unknown[]) {
    if (rules.length >= CUSTOM_RULES_MAX) break;
    const rule = sanitizeRule(item);
    if (rule) rules.push(rule);
  }
  return rules;
}
