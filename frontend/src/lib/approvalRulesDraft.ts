// Alteracoes ao rascunho das regras de aprovacao (puras, usadas pelo modal).
import {
  CUSTOM_RULES_MAX,
  emptyCustomRuleDraft,
  rulesToDraft,
  type ApprovalRulesDraft,
  type CustomRuleDraft,
} from './approvalRules';
import type { ApprovalRulesPreset } from '../api/approvalRulesService';

// Editar qualquer valor deixa de ser o preset.
export function patchDraft(draft: ApprovalRulesDraft, changes: Partial<ApprovalRulesDraft>): ApprovalRulesDraft {
  return { ...draft, ...changes, presetKey: changes.presetKey ?? null };
}

// Escolher um preset preenche tudo. Os presets nao trazem regras extra:
// mantem as que o utilizador ja escreveu.
export function applyPreset(draft: ApprovalRulesDraft | null, preset: ApprovalRulesPreset): ApprovalRulesDraft {
  const customRules = draft?.customRules ?? [];
  return {
    ...rulesToDraft({ ...preset.rules, presetKey: customRules.length > 0 ? null : preset.key }),
    customRules,
  };
}

export function patchCustomRule(
  draft: ApprovalRulesDraft,
  key: string,
  changes: Partial<CustomRuleDraft>,
): ApprovalRulesDraft {
  return {
    ...draft,
    presetKey: null,
    customRules: draft.customRules.map((rule) => (rule.key === key ? { ...rule, ...changes } : rule)),
  };
}

// No limite de regras extra devolve o mesmo rascunho.
export function addCustomRule(draft: ApprovalRulesDraft): ApprovalRulesDraft {
  if (draft.customRules.length >= CUSTOM_RULES_MAX) return draft;
  return { ...draft, presetKey: null, customRules: [...draft.customRules, emptyCustomRuleDraft()] };
}

export function removeCustomRule(draft: ApprovalRulesDraft, key: string): ApprovalRulesDraft {
  return { ...draft, presetKey: null, customRules: draft.customRules.filter((rule) => rule.key !== key) };
}
