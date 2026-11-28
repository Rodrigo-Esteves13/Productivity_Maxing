import { describe, expect, it } from 'vitest';
import { accountToInput, goalToInput, holdingToInput, isUndoGone, undoErrorKey, undoResultKey } from './financeUndo';
import type { FinanceAccount, FinanceGoal, FinanceHolding } from '../api/financeService';

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

describe('restore payloads', () => {
  it('rebuilds an account input', () => {
    const account = { id: 'a', name: 'Bank', type: 'BANK', balanceCents: 1200, currency: null } as FinanceAccount;
    expect(accountToInput(account)).toEqual({ name: 'Bank', type: 'BANK', balanceCents: 1200 });
  });

  it('rebuilds a goal input with a date only deadline', () => {
    const goal = { id: 'g', kind: 'SAVINGS', name: 'Trip', targetCents: 5000, savedCents: 100, deadline: '2027-01-05T00:00:00.000Z', monthlyPlanCents: null } as FinanceGoal;
    expect(goalToInput(goal)).toEqual({ kind: 'SAVINGS', name: 'Trip', targetCents: 5000, savedCents: 100, deadline: '2027-01-05', monthlyPlanCents: null });
    expect(goalToInput({ ...goal, deadline: null }).deadline).toBeNull();
  });

  it('rebuilds a holding input with quantity only', () => {
    const holding = { id: 'h', accountId: 'a', symbol: 'VWCE.DE', name: 'World', quantity: '1.500000', costBasisCents: 999 } as FinanceHolding;
    expect(holdingToInput(holding)).toEqual({ symbol: 'VWCE.DE', name: 'World', accountId: 'a', quantity: '1.500000' });
  });
});
