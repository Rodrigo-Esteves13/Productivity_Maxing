import { describe, expect, it } from 'vitest';
import { previewOccurrences, type PreviewRule } from './financeSchedule';

const base: PreviewRule = {
  date: '2026-01-25',
  frequency: 'MONTHLY',
  payDayRule: 'FIXED_DAY',
  payDay: 25,
  endDate: null,
  skipFirstOccurrences: 0,
  paidInArrearsMonths: 0,
  amountCents: 100000,
  withheldCents: 0,
};

describe('previewOccurrences', () => {
  it('lists the next monthly pay days', () => {
    const out = previewOccurrences(base, '2026-03-01', 3);
    expect(out.map((o) => o.date)).toEqual(['2026-03-25', '2026-04-25', '2026-05-25']);
  });

  it('still lists `count` pay days for a rule that started long ago', () => {
    const out = previewOccurrences({ ...base, date: '2024-01-25' }, '2026-11-01', 3);
    expect(out.map((o) => o.date)).toEqual(['2026-11-25', '2026-12-25', '2027-01-25']);
  });

  it('skips the first occurrences already received', () => {
    const out = previewOccurrences({ ...base, date: '2026-03-25', skipFirstOccurrences: 1 }, '2026-03-01', 2);
    expect(out.map((o) => o.date)).toEqual(['2026-04-25', '2026-05-25']);
  });

  it('pays in arrears by moving the pay day later', () => {
    const out = previewOccurrences({ ...base, date: '2026-03-25', paidInArrearsMonths: 1 }, '2026-03-01', 1);
    expect(out[0].date).toBe('2026-04-25');
  });

  it('marks the withheld first pay and the release on the end date', () => {
    const rule = { ...base, date: '2026-03-25', withheldCents: 30000, endDate: '2026-05-31' };
    const out = previewOccurrences(rule, '2026-03-01', 10);
    expect(out[0]).toMatchObject({ date: '2026-03-25', amountCents: 70000, reason: 'WITHHELD_FIRST' });
    expect(out[out.length - 1]).toMatchObject({ date: '2026-05-31', amountCents: 30000, reason: 'WITHHELD_RELEASE' });
  });

  it('uses the first business day of the next month', () => {
    const rule = { ...base, date: '2026-03-01', payDayRule: 'FIRST_BUSINESS_DAY_NEXT_MONTH' as const };
    const out = previewOccurrences(rule, '2026-03-01', 2);
    expect(out.map((o) => o.date)).toEqual(['2026-04-01', '2026-05-01']);
  });
});
