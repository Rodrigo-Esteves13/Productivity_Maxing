import { describe, expect, it } from 'vitest';
import { isUndoGone, undoErrorKey, undoResultKey } from './financeUndo';

const httpError = (status: number) => ({ response: { status } });

describe('undoErrorKey', () => {
  it.each([
    [404, 'financeUndo.notFound'],
    [409, 'financeUndo.conflict'],
    [429, 'financeUndo.rateLimited'],
    [500, 'financeUndo.error'],
  ])('maps HTTP %i to %s', (status, key) => {
    expect(undoErrorKey(httpError(status))).toBe(key);
  });

  it('falls back for a network error or a non object', () => {
    expect(undoErrorKey(new Error('offline'))).toBe('financeUndo.error');
    expect(undoErrorKey(null)).toBe('financeUndo.error');
  });
});

describe('isUndoGone', () => {
  it('is true only for 404', () => {
    expect(isUndoGone(httpError(404))).toBe(true);
    expect(isUndoGone(httpError(409))).toBe(false);
    expect(isUndoGone(undefined)).toBe(false);
  });
});

describe('undoResultKey', () => {
  const full = { incomeEntryRemoved: true, debtRestored: true, remainingCents: 100 };

  it('plain success when both the income and the debt were handled', () => {
    expect(undoResultKey(full)).toBe('financeUndo.done');
  });

  it('warns when the income entry was not found', () => {
    expect(undoResultKey({ ...full, incomeEntryRemoved: false })).toBe('financeUndo.doneNoIncome');
  });

  it('warns when the debt could not be restored', () => {
    expect(undoResultKey({ ...full, debtRestored: false, remainingCents: null })).toBe('financeUndo.doneNoDebt');
  });

  it('warns when only the payment row was removed', () => {
    expect(undoResultKey({ incomeEntryRemoved: false, debtRestored: false, remainingCents: null })).toBe(
      'financeUndo.doneOnlyPayment',
    );
  });
});
