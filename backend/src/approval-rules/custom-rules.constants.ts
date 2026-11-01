// Constantes das regras custom de aprovacao (contrato partilhado).
import type { CustomRuleKind } from './approval-rules.types';

export const CUSTOM_RULE_KINDS: readonly CustomRuleKind[] = [
  'MAX_BELOW',
  'GROUP_AVG_MIN',
];
export const CUSTOM_RULES_MAX = 10;
export const CUSTOM_RULE_LABEL_MAX = 60;
export const CUSTOM_RULE_MAX_BELOW_LIMIT = 20;
