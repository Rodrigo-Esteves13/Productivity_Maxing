import { describe, expect, it } from 'vitest';
import { addCustomRule, applyPreset, patchCustomRule, patchDraft, removeCustomRule } from './approvalRulesDraft';
import { CUSTOM_RULES_MAX, emptyCustomRuleDraft, type ApprovalRulesDraft } from './approvalRules';
import type { ApprovalRulesPreset } from '../api/approvalRulesService';

const draft: ApprovalRulesDraft = {
  presetKey: 'generic',
  scaleMin: '0',
  scaleMax: '20',
  passMark: '10',
  rounding: 'NONE' as ApprovalRulesDraft['rounding'],
  componentMinGrade: '',
  secondThreshold: '',
  maxBelowSecondThreshold: '',
  hasExamTrack: false,
  hasResitTrack: false,
  customRules: [],
};

const preset = {
  key: 'other',
  rules: { ...draft, presetKey: null, scaleMin: 1, scaleMax: 10, passMark: 5, componentMinGrade: null, secondThreshold: null, maxBelowSecondThreshold: null, customRules: [] },
} as unknown as ApprovalRulesPreset;

describe('patchDraft', () => {
  it('editar um valor deixa de ser o preset', () => {
    expect(patchDraft(draft, { passMark: '12' })).toMatchObject({ passMark: '12', presetKey: null });
  });
  it('respeita um presetKey explicito', () => {
    expect(patchDraft(draft, { presetKey: 'x' }).presetKey).toBe('x');
  });
});

describe('applyPreset', () => {
  it('preenche tudo com o preset', () => {
    expect(applyPreset(draft, preset)).toMatchObject({ presetKey: 'other', scaleMax: '10', customRules: [] });
  });
  it('mantem as regras extra e fica sem preset', () => {
    const rule = emptyCustomRuleDraft();
    const next = applyPreset({ ...draft, customRules: [rule] }, preset);
    expect(next.presetKey).toBeNull();
    expect(next.customRules).toEqual([rule]);
  });
});

describe('regras extra', () => {
  it('acrescenta, altera e remove', () => {
    const added = addCustomRule(draft);
    expect(added.customRules).toHaveLength(1);
    expect(added.presetKey).toBeNull();
    const key = added.customRules[0].key;
    expect(patchCustomRule(added, key, { threshold: '8' }).customRules[0].threshold).toBe('8');
    expect(removeCustomRule(added, key).customRules).toEqual([]);
  });
  it('nao passa do limite', () => {
    const full = { ...draft, customRules: Array.from({ length: CUSTOM_RULES_MAX }, () => emptyCustomRuleDraft()) };
    expect(addCustomRule(full)).toBe(full);
  });
});
