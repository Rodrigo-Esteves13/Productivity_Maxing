// Tipos e validacao das regras de aprovacao (espelha
// backend/src/approval-rules/approval-rules.types.ts). Funcoes puras.

export type ApprovalRounding = 'NONE' | 'UP_TO_INTEGER_AT_HALF';

export type CustomRuleKind = 'MAX_BELOW' | 'GROUP_AVG_MIN';

export const CUSTOM_RULE_KINDS: CustomRuleKind[] = ['MAX_BELOW', 'GROUP_AVG_MIN'];

export const CUSTOM_RULE_KIND_LABEL_KEY: Record<CustomRuleKind, string> = {
  MAX_BELOW: 'approvalRules.custom.kind.MAX_BELOW',
  GROUP_AVG_MIN: 'approvalRules.custom.kind.GROUP_AVG_MIN',
};

// Iguais ao backend (custom-rules.constants.ts).
/** Chave do preset neutro (igual ao backend); ponto de partida do modo em massa. */
export const GENERIC_PRESET_KEY = 'generic';

export const CUSTOM_RULES_MAX = 10;
export const CUSTOM_RULE_LABEL_MAX = 60;
export const CUSTOM_RULE_MAX_BELOW_LIMIT = 20;

/** Regra extra, somada as duas regras fixas. maxBelow so existe em MAX_BELOW. */
export interface CustomRule {
  kind: CustomRuleKind;
  threshold: number;
  maxBelow: number | null;
  labelContains: string | null;
}

export interface ApprovalRules {
  presetKey: string | null;
  scaleMin: number;
  scaleMax: number;
  passMark: number;
  rounding: ApprovalRounding;
  componentMinGrade: number | null;
  secondThreshold: number | null;
  maxBelowSecondThreshold: number | null;
  hasExamTrack: boolean;
  hasResitTrack: boolean;
  customRules: CustomRule[];
}

export type ApprovalRulesScope = 'program' | 'area';

export const ROUNDING_OPTIONS: ApprovalRounding[] = ['NONE', 'UP_TO_INTEGER_AT_HALF'];

export const ROUNDING_LABEL_KEY: Record<ApprovalRounding, string> = {
  NONE: 'approvalRules.rounding.none',
  UP_TO_INTEGER_AT_HALF: 'approvalRules.rounding.half',
};

export interface CustomRuleDraft {
  // Chave estavel so para o React (nao vai para o servidor).
  key: string;
  kind: CustomRuleKind;
  threshold: string;
  maxBelow: string;
  labelContains: string;
}

export interface CustomRuleErrors {
  threshold?: string;
  maxBelow?: string;
  label?: string;
}

let customKeySeed = 0;
export const nextCustomRuleKey = (): string => `custom-rule-${(customKeySeed += 1)}`;

export const emptyCustomRuleDraft = (): CustomRuleDraft => ({
  key: nextCustomRuleKey(),
  kind: 'MAX_BELOW',
  threshold: '',
  maxBelow: '1',
  labelContains: '',
});

/** Todos os campos numericos como texto, para o utilizador poder escrever livremente. */
export interface ApprovalRulesDraft {
  presetKey: string | null;
  scaleMin: string;
  scaleMax: string;
  passMark: string;
  rounding: ApprovalRounding;
  componentMinGrade: string;
  secondThreshold: string;
  maxBelowSecondThreshold: string;
  hasExamTrack: boolean;
  hasResitTrack: boolean;
  customRules: CustomRuleDraft[];
}

export type ApprovalRulesField =
  | 'scaleMin'
  | 'scaleMax'
  | 'passMark'
  | 'componentMinGrade'
  | 'secondThreshold'
  | 'maxBelowSecondThreshold';

export type ApprovalRulesErrors = Partial<Record<ApprovalRulesField, string>>;

const numToText = (value: number | null): string => (value === null ? '' : String(value));

export function rulesToDraft(rules: ApprovalRules): ApprovalRulesDraft {
  return {
    presetKey: rules.presetKey,
    scaleMin: numToText(rules.scaleMin),
    scaleMax: numToText(rules.scaleMax),
    passMark: numToText(rules.passMark),
    rounding: rules.rounding,
    componentMinGrade: numToText(rules.componentMinGrade),
    secondThreshold: numToText(rules.secondThreshold),
    maxBelowSecondThreshold: numToText(rules.maxBelowSecondThreshold),
    hasExamTrack: rules.hasExamTrack,
    hasResitTrack: rules.hasResitTrack,
    customRules: (rules.customRules ?? []).map((rule) => ({
      key: nextCustomRuleKey(),
      kind: rule.kind,
      threshold: numToText(rule.threshold),
      maxBelow: numToText(rule.maxBelow),
      labelContains: rule.labelContains ?? '',
    })),
  };
}

/** Aceita virgula decimal. Vazio ou invalido devolve null. */
export function parseNumber(text: string): number | null {
  const trimmed = text.trim().replace(',', '.');
  if (trimmed === '') return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

// Iguais ao backend (upsert-approval-rules.dto.ts): notas com no maximo 2
// casas e escala entre 0 e 1000.
const MAX_DECIMAL_PLACES = 2;
const SCALE_LIMIT = 1000;

function hasTooManyDecimals(value: number): boolean {
  const factor = 10 ** MAX_DECIMAL_PLACES;
  return Math.abs(value * factor - Math.round(value * factor)) > 1e-9;
}

export interface ApprovalRulesValidation {
  errors: ApprovalRulesErrors;
  isValid: boolean;
  /** Um item por regra extra (mesma ordem do rascunho). */
  customErrors: CustomRuleErrors[];
  /** Presente apenas quando isValid. */
  rules: ApprovalRules | null;
}

export function validateApprovalRulesDraft(draft: ApprovalRulesDraft): ApprovalRulesValidation {
  const errors: ApprovalRulesErrors = {};

  const scaleMin = parseNumber(draft.scaleMin);
  const scaleMax = parseNumber(draft.scaleMax);
  const passMark = parseNumber(draft.passMark);
  const componentMin = parseNumber(draft.componentMinGrade);
  const second = parseNumber(draft.secondThreshold);
  const maxBelow = parseNumber(draft.maxBelowSecondThreshold);

  if (scaleMin === null) errors.scaleMin = 'approvalRules.error.required';
  if (scaleMax === null) errors.scaleMax = 'approvalRules.error.required';
  if (scaleMin !== null && scaleMax !== null && scaleMin >= scaleMax) {
    errors.scaleMax = 'approvalRules.error.scaleOrder';
  }
  if (scaleMin !== null && (scaleMin < 0 || scaleMin > SCALE_LIMIT)) {
    errors.scaleMin = 'approvalRules.error.scaleRange';
  } else if (scaleMin !== null && hasTooManyDecimals(scaleMin)) {
    errors.scaleMin = 'approvalRules.error.decimals';
  }
  if (scaleMax !== null && (scaleMax < 0 || scaleMax > SCALE_LIMIT)) {
    errors.scaleMax = 'approvalRules.error.scaleRange';
  } else if (scaleMax !== null && hasTooManyDecimals(scaleMax) && !errors.scaleMax) {
    errors.scaleMax = 'approvalRules.error.decimals';
  }

  const inScale = (v: number) =>
    scaleMin !== null && scaleMax !== null && v >= scaleMin && v <= scaleMax;
  const scaleKnown = !errors.scaleMin && !errors.scaleMax;

  if (passMark === null) {
    errors.passMark = 'approvalRules.error.required';
  } else if (hasTooManyDecimals(passMark)) {
    errors.passMark = 'approvalRules.error.decimals';
  } else if (scaleKnown && (!inScale(passMark) || passMark === scaleMin)) {
    errors.passMark = 'approvalRules.error.passMarkRange';
  }

  const hasComponentMin = draft.componentMinGrade.trim() !== '';
  if (hasComponentMin) {
    if (componentMin === null) {
      errors.componentMinGrade = 'approvalRules.error.notNumber';
    } else if (hasTooManyDecimals(componentMin)) {
      errors.componentMinGrade = 'approvalRules.error.decimals';
    } else if (scaleKnown && !inScale(componentMin)) {
      errors.componentMinGrade = 'approvalRules.error.outOfScale';
    } else if (passMark !== null && componentMin > passMark) {
      errors.componentMinGrade = 'approvalRules.error.componentAbovePass';
    }
  }

  const hasSecond = draft.secondThreshold.trim() !== '';
  if (hasSecond) {
    if (second === null) {
      errors.secondThreshold = 'approvalRules.error.notNumber';
    } else if (hasTooManyDecimals(second)) {
      errors.secondThreshold = 'approvalRules.error.decimals';
    } else if (scaleKnown && !inScale(second)) {
      errors.secondThreshold = 'approvalRules.error.outOfScale';
    } else if (passMark !== null && second >= passMark) {
      errors.secondThreshold = 'approvalRules.error.secondBelowPass';
    }

    if (draft.maxBelowSecondThreshold.trim() === '') {
      errors.maxBelowSecondThreshold = 'approvalRules.error.required';
    } else if (maxBelow === null || !Number.isInteger(maxBelow) || maxBelow < 0) {
      errors.maxBelowSecondThreshold = 'approvalRules.error.wholeNumber';
    }
  }

  const customErrors = draft.customRules.map((rule): CustomRuleErrors => {
    const result: CustomRuleErrors = {};
    const threshold = parseNumber(rule.threshold);
    if (threshold === null || hasTooManyDecimals(threshold) || (scaleKnown && !inScale(threshold))) {
      result.threshold = 'approvalRules.custom.error.threshold';
    }
    if (rule.kind === 'MAX_BELOW') {
      const count = parseNumber(rule.maxBelow);
      if (
        count === null ||
        !Number.isInteger(count) ||
        count < 0 ||
        count > CUSTOM_RULE_MAX_BELOW_LIMIT
      ) {
        result.maxBelow = 'approvalRules.custom.error.maxBelow';
      }
    }
    if (rule.labelContains.trim().length > CUSTOM_RULE_LABEL_MAX) {
      result.label = 'approvalRules.custom.error.label';
    }
    return result;
  });
  const customOk =
    draft.customRules.length <= CUSTOM_RULES_MAX &&
    customErrors.every((entry) => Object.keys(entry).length === 0);

  const isValid = Object.keys(errors).length === 0 && customOk;
  if (!isValid || scaleMin === null || scaleMax === null || passMark === null) {
    return { errors, customErrors, isValid: false, rules: null };
  }

  return {
    errors,
    customErrors,
    isValid: true,
    rules: {
      // Com regras extra o resultado ja nao e um preset puro.
      presetKey: draft.customRules.length > 0 ? null : draft.presetKey,
      scaleMin,
      scaleMax,
      passMark,
      rounding: draft.rounding,
      componentMinGrade: hasComponentMin ? componentMin : null,
      secondThreshold: hasSecond ? second : null,
      maxBelowSecondThreshold: hasSecond ? maxBelow : null,
      hasExamTrack: draft.hasExamTrack,
      hasResitTrack: draft.hasResitTrack,
      customRules: draft.customRules.map((rule) => ({
        kind: rule.kind,
        threshold: parseNumber(rule.threshold) as number,
        maxBelow: rule.kind === 'MAX_BELOW' ? (parseNumber(rule.maxBelow) as number) : null,
        labelContains: rule.labelContains.trim() === '' ? null : rule.labelContains.trim(),
      })),
    },
  };
}
