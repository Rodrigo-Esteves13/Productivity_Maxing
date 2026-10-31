import type { ApprovalRounding, ApprovalRules } from './approval-rules.types';

// Presets de regras de aprovacao (N46). Sao so dados: o motor de risco nao
// sabe nada de universidades, le sempre um ApprovalRules.

export const PRESET_PT_PT_ISMAI = 'pt-PT-ismai';
export const PRESET_GENERIC = 'generic';

export const APPROVAL_PRESET_KEYS = [
  PRESET_PT_PT_ISMAI,
  PRESET_GENERIC,
] as const;
export type ApprovalPresetKey = (typeof APPROVAL_PRESET_KEYS)[number];

export const APPROVAL_ROUNDINGS = ['NONE', 'UP_TO_INTEGER_AT_HALF'] as const;

// Escala por omissao da app (igual ao default de AcademicProgram.gradeScale).
export const DEFAULT_SCALE_MIN = 0;
export const DEFAULT_SCALE_MAX = 20;

// Limites dos DTOs: escalas reais vao de 0-5 a 0-100; 1000 cobre tudo sem
// aceitar numeros absurdos.
export const APPROVAL_SCALE_LIMIT = 1000;
export const MAX_BELOW_SECOND_THRESHOLD_LIMIT = 50;

// AcademicProgram/AcademicPeriod.roundFinalGrade (true) = arredonda a nota
// final a inteiro (9.5 -> 10), como o resto da app.
const ROUNDING_BY_FINAL_GRADE_FLAG: Readonly<
  Record<'true' | 'false', ApprovalRounding>
> = { true: 'UP_TO_INTEGER_AT_HALF', false: 'NONE' };

/**
 * Regras "passa a meio da escala", sem regras extra nem pistas. O
 * arredondamento segue o roundFinalGrade efetivo do programa/periodo.
 */
export function genericRulesForScale(
  scaleMin: number,
  scaleMax: number,
  roundFinalGrade: boolean = false,
): ApprovalRules {
  return {
    presetKey: PRESET_GENERIC,
    scaleMin,
    scaleMax,
    passMark: scaleMin + (scaleMax - scaleMin) / 2,
    rounding: ROUNDING_BY_FINAL_GRADE_FLAG[`${roundFinalGrade}`],
    componentMinGrade: null,
    secondThreshold: null,
    maxBelowSecondThreshold: null,
    hasExamTrack: false,
    hasResitTrack: false,
  };
}

/**
 * ISMAI (pt-PT): escala 0-20, passa com 10 depois de arredondar (9.5 -> 10),
 * nenhum componente abaixo de 6, no maximo um abaixo de 8, com exame e
 * recurso.
 */
const PT_PT_ISMAI_RULES: ApprovalRules = {
  presetKey: PRESET_PT_PT_ISMAI,
  scaleMin: 0,
  scaleMax: 20,
  passMark: 10,
  rounding: 'UP_TO_INTEGER_AT_HALF',
  componentMinGrade: 6,
  secondThreshold: 8,
  maxBelowSecondThreshold: 1,
  hasExamTrack: true,
  hasResitTrack: true,
};

export const APPROVAL_PRESETS: Readonly<
  Record<ApprovalPresetKey, Readonly<ApprovalRules>>
> = Object.freeze({
  [PRESET_PT_PT_ISMAI]: Object.freeze({ ...PT_PT_ISMAI_RULES }),
  [PRESET_GENERIC]: Object.freeze(
    genericRulesForScale(DEFAULT_SCALE_MIN, DEFAULT_SCALE_MAX),
  ),
});

export function isApprovalPresetKey(key: unknown): key is ApprovalPresetKey {
  return (
    typeof key === 'string' &&
    (APPROVAL_PRESET_KEYS as readonly string[]).includes(key)
  );
}

/** Copia mutavel de um preset (nunca devolver o objeto congelado). */
export function presetRules(key: ApprovalPresetKey): ApprovalRules {
  return { ...APPROVAL_PRESETS[key] };
}
