// Tipos e validacao das regras de aprovacao (espelha
// backend/src/approval-rules/approval-rules.types.ts). Funcoes puras.

export type ApprovalRounding = 'NONE' | 'UP_TO_INTEGER_AT_HALF';

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
}

export type ApprovalRulesScope = 'program' | 'area';

export const ROUNDING_OPTIONS: ApprovalRounding[] = ['NONE', 'UP_TO_INTEGER_AT_HALF'];

export const ROUNDING_LABEL_KEY: Record<ApprovalRounding, string> = {
  NONE: 'approvalRules.rounding.none',
  UP_TO_INTEGER_AT_HALF: 'approvalRules.rounding.half',
};

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

  const isValid = Object.keys(errors).length === 0;
  if (!isValid || scaleMin === null || scaleMax === null || passMark === null) {
    return { errors, isValid: false, rules: null };
  }

  return {
    errors,
    isValid: true,
    rules: {
      presetKey: draft.presetKey,
      scaleMin,
      scaleMax,
      passMark,
      rounding: draft.rounding,
      componentMinGrade: hasComponentMin ? componentMin : null,
      secondThreshold: hasSecond ? second : null,
      maxBelowSecondThreshold: hasSecond ? maxBelow : null,
      hasExamTrack: draft.hasExamTrack,
      hasResitTrack: draft.hasResitTrack,
    },
  };
}
