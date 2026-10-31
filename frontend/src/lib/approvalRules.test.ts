import { describe, expect, it } from 'vitest';
import {
  rulesToDraft,
  validateApprovalRulesDraft,
  parseNumber,
  type ApprovalRules,
} from './approvalRules';

const BASE: ApprovalRules = {
  presetKey: 'generic',
  scaleMin: 0,
  scaleMax: 20,
  passMark: 10,
  rounding: 'UP_TO_INTEGER_AT_HALF',
  componentMinGrade: 8,
  secondThreshold: 8,
  maxBelowSecondThreshold: 1,
  hasExamTrack: true,
  hasResitTrack: true,
};

const draftWith = (patch: Record<string, string | boolean | null>) => ({
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
