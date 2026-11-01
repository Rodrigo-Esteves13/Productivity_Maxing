import { describe, expect, it } from 'vitest';
import {
  emptyCustomRuleDraft,
  rulesToDraft,
  validateApprovalRulesDraft,
  parseNumber,
  CUSTOM_RULES_MAX,
  GENERIC_PRESET_KEY,
  type ApprovalRules,
} from './approvalRules';

const BASE: ApprovalRules = {
  presetKey: GENERIC_PRESET_KEY,
  scaleMin: 0,
  scaleMax: 20,
  passMark: 10,
  rounding: 'UP_TO_INTEGER_AT_HALF',
  componentMinGrade: 8,
  secondThreshold: 8,
  maxBelowSecondThreshold: 1,
  hasExamTrack: true,
  hasResitTrack: true,
  customRules: [],
};

const draftWith = (patch: Partial<ReturnType<typeof rulesToDraft>>) => ({
  ...rulesToDraft(BASE),
  ...patch,
});

describe('approvalRules validation', () => {
  it('accepts valid rules and round-trips them', () => {
    const result = validateApprovalRulesDraft(rulesToDraft(BASE));
    expect(result.isValid).toBe(true);
    expect(result.rules).toEqual(BASE);
  });

  it('accepts comma decimals', () => {
    expect(parseNumber('9,5')).toBe(9.5);
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('abc')).toBeNull();
  });

  it('rejects scale with min >= max', () => {
    const r = validateApprovalRulesDraft(draftWith({ scaleMin: '20', scaleMax: '20' }));
    expect(r.errors.scaleMax).toBe('approvalRules.error.scaleOrder');
    expect(r.rules).toBeNull();
  });

  it('requires scale and pass mark', () => {
    const r = validateApprovalRulesDraft(draftWith({ scaleMin: '', passMark: '' }));
    expect(r.errors.scaleMin).toBe('approvalRules.error.required');
    expect(r.errors.passMark).toBe('approvalRules.error.required');
  });

  it('rejects pass mark outside the scale or at the minimum', () => {
    expect(validateApprovalRulesDraft(draftWith({ passMark: '21' })).errors.passMark).toBe(
      'approvalRules.error.passMarkRange',
    );
    expect(validateApprovalRulesDraft(draftWith({ passMark: '0' })).errors.passMark).toBe(
      'approvalRules.error.passMarkRange',
    );
  });

  it('rejects component minimum out of scale or above the pass mark', () => {
    expect(
      validateApprovalRulesDraft(draftWith({ componentMinGrade: '25' })).errors.componentMinGrade,
    ).toBe('approvalRules.error.outOfScale');
    expect(
      validateApprovalRulesDraft(draftWith({ componentMinGrade: '12' })).errors.componentMinGrade,
    ).toBe('approvalRules.error.componentAbovePass');
  });

  it('treats an empty component minimum as no rule', () => {
    const r = validateApprovalRulesDraft(draftWith({ componentMinGrade: '' }));
    expect(r.isValid).toBe(true);
    expect(r.rules?.componentMinGrade).toBeNull();
  });

  it('rejects a second threshold at or above the pass mark', () => {
    expect(
      validateApprovalRulesDraft(draftWith({ secondThreshold: '10' })).errors.secondThreshold,
    ).toBe('approvalRules.error.secondBelowPass');
  });

  it('requires a whole non-negative max when the second threshold is set', () => {
    expect(
      validateApprovalRulesDraft(draftWith({ maxBelowSecondThreshold: '' })).errors
        .maxBelowSecondThreshold,
    ).toBe('approvalRules.error.required');
    expect(
      validateApprovalRulesDraft(draftWith({ maxBelowSecondThreshold: '1.5' })).errors
        .maxBelowSecondThreshold,
    ).toBe('approvalRules.error.wholeNumber');
    expect(
      validateApprovalRulesDraft(draftWith({ maxBelowSecondThreshold: '-1' })).errors
        .maxBelowSecondThreshold,
    ).toBe('approvalRules.error.wholeNumber');
  });

  it('drops the max when there is no second threshold', () => {
    const r = validateApprovalRulesDraft(
      draftWith({ secondThreshold: '', maxBelowSecondThreshold: '3' }),
    );
    expect(r.isValid).toBe(true);
    expect(r.rules?.secondThreshold).toBeNull();
    expect(r.rules?.maxBelowSecondThreshold).toBeNull();
  });
});

describe('approvalRules validation: backend parity', () => {
  it('rejects more than 2 decimal places', () => {
    expect(validateApprovalRulesDraft(draftWith({ passMark: '9.555' })).errors.passMark).toBe(
      'approvalRules.error.decimals',
    );
    expect(
      validateApprovalRulesDraft(draftWith({ componentMinGrade: '6.123' })).errors
        .componentMinGrade,
    ).toBe('approvalRules.error.decimals');
    expect(
      validateApprovalRulesDraft(draftWith({ secondThreshold: '7.001' })).errors.secondThreshold,
    ).toBe('approvalRules.error.decimals');
    expect(validateApprovalRulesDraft(draftWith({ scaleMax: '20.123' })).errors.scaleMax).toBe(
      'approvalRules.error.decimals',
    );
    expect(validateApprovalRulesDraft(draftWith({ passMark: '9,25' })).isValid).toBe(true);
  });

  it('rejects a negative scale or one above 1000', () => {
    expect(validateApprovalRulesDraft(draftWith({ scaleMin: '-1' })).errors.scaleMin).toBe(
      'approvalRules.error.scaleRange',
    );
    expect(validateApprovalRulesDraft(draftWith({ scaleMax: '1001' })).errors.scaleMax).toBe(
      'approvalRules.error.scaleRange',
    );
  });

  it('requires the pass mark above the scale minimum', () => {
    expect(
      validateApprovalRulesDraft(draftWith({ scaleMin: '5', passMark: '5' })).errors.passMark,
    ).toBe('approvalRules.error.passMarkRange');
  });
});

describe('approvalRules custom rules', () => {
  const withCustom = (rules: ApprovalRules['customRules']) =>
    rulesToDraft({ ...BASE, customRules: rules });

  it('round-trips custom rules and trims the label', () => {
    const draft = withCustom([
      { kind: 'MAX_BELOW', threshold: 9, maxBelow: 2, labelContains: 'quiz' },
      { kind: 'GROUP_AVG_MIN', threshold: 10, maxBelow: null, labelContains: null },
    ]);
    draft.customRules[0].labelContains = '  quiz ';
    const r = validateApprovalRulesDraft(draft);
    expect(r.isValid).toBe(true);
    expect(r.rules?.customRules).toEqual([
      { kind: 'MAX_BELOW', threshold: 9, maxBelow: 2, labelContains: 'quiz' },
      { kind: 'GROUP_AVG_MIN', threshold: 10, maxBelow: null, labelContains: null },
    ]);
  });

  it('keeps the two fixed rules untouched when custom rules exist', () => {
    const draft = withCustom([{ kind: 'GROUP_AVG_MIN', threshold: 10, maxBelow: null, labelContains: 'lab' }]);
    const r = validateApprovalRulesDraft(draft);
    expect(r.rules?.componentMinGrade).toBe(8);
    expect(r.rules?.secondThreshold).toBe(8);
    expect(r.rules?.maxBelowSecondThreshold).toBe(1);
  });

  it('flags threshold outside the scale or with too many decimals', () => {
    const draft = withCustom([
      { kind: 'GROUP_AVG_MIN', threshold: 10, maxBelow: null, labelContains: null },
      { kind: 'GROUP_AVG_MIN', threshold: 10, maxBelow: null, labelContains: null },
    ]);
    draft.customRules[0].threshold = '25';
    draft.customRules[1].threshold = '9.123';
    const r = validateApprovalRulesDraft(draft);
    expect(r.isValid).toBe(false);
    expect(r.customErrors[0].threshold).toBe('approvalRules.custom.error.threshold');
    expect(r.customErrors[1].threshold).toBe('approvalRules.custom.error.threshold');
  });

  it('requires a whole maxBelow in 0..20 only for MAX_BELOW', () => {
    const draft = withCustom([{ kind: 'MAX_BELOW', threshold: 9, maxBelow: 1, labelContains: null }]);
    for (const bad of ['', '1.5', '-1', '21']) {
      draft.customRules[0].maxBelow = bad;
      expect(validateApprovalRulesDraft(draft).customErrors[0].maxBelow).toBe(
        'approvalRules.custom.error.maxBelow',
      );
    }
    draft.customRules[0].kind = 'GROUP_AVG_MIN';
    draft.customRules[0].maxBelow = 'abc';
    const r = validateApprovalRulesDraft(draft);
    expect(r.isValid).toBe(true);
    expect(r.rules?.customRules[0].maxBelow).toBeNull();
  });

  it('rejects a label over 60 characters', () => {
    const draft = withCustom([{ kind: 'GROUP_AVG_MIN', threshold: 10, maxBelow: null, labelContains: null }]);
    draft.customRules[0].labelContains = 'x'.repeat(61);
    expect(validateApprovalRulesDraft(draft).customErrors[0].label).toBe(
      'approvalRules.custom.error.label',
    );
  });

  it('rejects more than the limit of rules', () => {
    const draft = withCustom([]);
    draft.customRules = Array.from({ length: CUSTOM_RULES_MAX + 1 }, () => ({
      ...emptyCustomRuleDraft(),
      threshold: '9',
    }));
    expect(validateApprovalRulesDraft(draft).isValid).toBe(false);
  });
});

describe('approvalRules presetKey with custom rules', () => {
  it('saves presetKey null when custom rules exist', () => {
    const draft = { ...draftWith({ presetKey: GENERIC_PRESET_KEY }), customRules: [{ ...emptyCustomRuleDraft(), threshold: '5' }] };
    const result = validateApprovalRulesDraft(draft);
    expect(result.rules?.presetKey).toBeNull();
  });

  it('keeps presetKey without custom rules', () => {
    const result = validateApprovalRulesDraft(draftWith({ presetKey: GENERIC_PRESET_KEY }));
    expect(result.rules?.presetKey).toBe(GENERIC_PRESET_KEY);
  });
});
