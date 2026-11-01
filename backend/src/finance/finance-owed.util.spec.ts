import { FinanceInterestKind } from '@prisma/client';
import { parseDateKey } from '../common/date-key.util';
import {
  accruedInterestCents,
  effectiveInterestKind,
  expectedValueCents,
  owedItem,
  summarizeOwed,
  type OwedInput,
} from './finance-owed.util';

const d = parseDateKey;

const loan = (over: Partial<OwedInput> = {}): OwedInput => ({
  id: 'o1',
  amountCents: 100000,
  note: null,
  debtorName: 'Joao',
  date: d('2026-01-01'),
  expectedDate: d('2027-01-01'),
  latePaymentRiskPct: 20,
  interestRatePct: 10,
  interestKind: FinanceInterestKind.SIMPLE,
  ...over,
});

describe('accruedInterestCents', () => {
  it('simple interest grows linearly over a 365 day year', () => {
    expect(
      accruedInterestCents(
        100000,
        10,
        'SIMPLE',
        d('2026-01-01'),
        d('2027-01-01'),
      ),
    ).toBe(10000);
    expect(
      accruedInterestCents(
        100000,
        10,
        'SIMPLE',
        d('2026-01-01'),
        d('2026-07-02'),
      ),
    ).toBe(4986);
  });

  it('monthly compound beats simple over a year', () => {
    // (1 + 0.1/12)^12 - 1 = 10.471%
    expect(
      accruedInterestCents(
        100000,
        10,
        'MONTHLY_COMPOUND',
        d('2026-01-01'),
        d('2027-01-01'),
      ),
    ).toBe(10471);
  });

  it('is zero without a rate, for NONE, or for a reversed range', () => {
    expect(
      accruedInterestCents(
        100000,
        null,
        null,
        d('2026-01-01'),
        d('2027-01-01'),
      ),
    ).toBe(0);
    expect(
      accruedInterestCents(
        100000,
        10,
        'NONE',
        d('2026-01-01'),
        d('2027-01-01'),
      ),
    ).toBe(0);
    expect(
      accruedInterestCents(
        100000,
        10,
        'SIMPLE',
        d('2027-01-01'),
        d('2026-01-01'),
      ),
    ).toBe(0);
  });

  it('a rate without a kind is simple interest', () => {
    expect(effectiveInterestKind(null, 5)).toBe('SIMPLE');
    expect(effectiveInterestKind('MONTHLY_COMPOUND', 0)).toBe('NONE');
  });
});

describe('owedItem', () => {
  it('weights the value at the due date by the late-payment risk', () => {
    const item = owedItem(loan(), d('2026-07-02'));
    expect(item).toMatchObject({
      principalCents: 100000,
      interestToDateCents: 4986,
      valueTodayCents: 104986,
      dueValueCents: 110000,
      expectedValueCents: 88000,
      overdue: false,
      daysLate: 0,
      lateScenario: { date: '2027-01-31', valueCents: 110822 },
    });
    expect(expectedValueCents(110000, 20)).toBe(88000);
  });

  it('keeps accruing interest after the due date when late', () => {
    const item = owedItem(loan(), d('2027-01-31'));
    expect(item).toMatchObject({
      overdue: true,
      daysLate: 30,
      valueTodayCents: 110822,
      dueValueCents: 110000,
      expectedValueCents: 88000,
      lateScenario: { date: '2027-03-02', valueCents: 111644 },
    });
  });

  it('without a due date there is no interest and no late scenario', () => {
    const item = owedItem(
      loan({
        expectedDate: null,
        interestRatePct: null,
        interestKind: null,
        latePaymentRiskPct: null,
      }),
      d('2026-06-01'),
    );
    expect(item).toMatchObject({
      interestKind: 'NONE',
      dueValueCents: 100000,
      expectedValueCents: 100000,
      latePaymentRiskPct: 0,
      overdue: false,
      lateScenario: null,
    });
  });
});

describe('summarizeOwed', () => {
  it('adds owed value, risk-weighted value and overdue count', () => {
    const s = summarizeOwed(
      [
        loan(),
        loan({
          id: 'o2',
          expectedDate: d('2026-03-01'),
          interestRatePct: null,
          latePaymentRiskPct: 50,
        }),
      ],
      d('2026-07-02'),
    );
    expect(s).toMatchObject({
      totalOwedCents: 104986 + 100000,
      totalRiskWeightedCents: 88000 + 50000,
      overdueCount: 1,
    });
  });
});
