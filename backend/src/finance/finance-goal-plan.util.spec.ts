import { FinanceEntryKind, FinanceFrequency } from '@prisma/client';
import { parseDateKey } from '../common/date-key.util';
import {
  addUtcMonths,
  estimateSurplus,
  historyMonthKeys,
  monthsUntil,
  planGoals,
  type GoalInput,
  type SurplusEstimate,
} from './finance-goal-plan.util';

const d = parseDateKey;
const today = d('2026-11-01');

const goal = (over: Partial<GoalInput>): GoalInput => ({
  id: 'g',
  targetCents: 120000,
  savedCents: 0,
  deadline: null,
  monthlyPlanCents: null,
  createdAt: d('2026-01-01'),
  ...over,
});

const surplus = (monthlyCents: number): SurplusEstimate => ({
  monthlyCents,
  source: 'HISTORY',
  monthsOfData: 3,
  lowConfidence: false,
});

const flow = (
  date: string,
  kind: FinanceEntryKind,
  amountCents: number,
  category = 'FOOD',
) => ({ date, kind, amountCents, category, projected: false });

describe('helpers', () => {
  it('addUtcMonths clamps to the end of short months', () => {
    expect(addUtcMonths(d('2026-01-31'), 1)).toEqual(d('2026-02-28'));
    expect(addUtcMonths(d('2026-11-15'), 3)).toEqual(d('2027-02-15'));
    expect(addUtcMonths(d('2026-03-31'), -1)).toEqual(d('2026-02-28'));
  });

  it('monthsUntil is at least 1 in the future and 0 when due', () => {
    expect(monthsUntil(today, d('2026-11-10'))).toBe(1);
    expect(monthsUntil(today, d('2026-12-31'))).toBe(2);
    expect(monthsUntil(today, d('2026-11-01'))).toBe(0);
    expect(monthsUntil(today, d('2026-10-01'))).toBe(0);
  });

  it('history keys are the full months before the current one', () => {
    expect(historyMonthKeys(d('2026-01-15'), 3)).toEqual([
      '2025-10',
      '2025-11',
      '2025-12',
    ]);
  });
});

describe('estimateSurplus', () => {
  const months = ['2026-08', '2026-09', '2026-10'];

  it('averages months with data and ignores money set aside for goals', () => {
    const s = estimateSurplus(
      [
        flow('2026-09-01', FinanceEntryKind.INCOME, 100000, 'SALARY'),
        flow('2026-09-10', FinanceEntryKind.EXPENSE, 60000),
        flow('2026-09-20', FinanceEntryKind.EXPENSE, 20000, 'SAVINGS'),
        flow('2026-10-01', FinanceEntryKind.INCOME, 100000, 'SALARY'),
        flow('2026-10-10', FinanceEntryKind.EXPENSE, 80000),
        // Fora da janela: nao conta.
        flow('2026-11-01', FinanceEntryKind.INCOME, 999999, 'SALARY'),
      ],
      months,
      [],
    );
    expect(s).toEqual({
      monthlyCents: 30000,
      source: 'HISTORY',
      monthsOfData: 2,
      lowConfidence: false,
    });
  });

  it('falls back to recurring rules with low confidence', () => {
    const s = estimateSurplus(
      [flow('2026-10-01', FinanceEntryKind.INCOME, 100000, 'SALARY')],
      months,
      [
        {
          kind: FinanceEntryKind.INCOME,
          amountCents: 90000,
          category: 'SALARY',
          frequency: FinanceFrequency.MONTHLY,
        },
        {
          kind: FinanceEntryKind.EXPENSE,
          amountCents: 12000,
          category: 'SUBSCRIPTIONS',
          frequency: FinanceFrequency.YEARLY,
        },
      ],
    );
    expect(s).toEqual({
      monthlyCents: 89000,
      source: 'RECURRING',
      monthsOfData: 1,
      lowConfidence: true,
    });
  });
});

describe('planGoals', () => {
  it('computes required monthly, completion date and ON_TRACK', () => {
    const { goalPlans } = planGoals(
      [goal({ deadline: d('2027-05-01'), monthlyPlanCents: 25000 })],
      surplus(50000),
      today,
    );
    expect(goalPlans[0]).toMatchObject({
      remainingCents: 120000,
      monthsLeft: 6,
      requiredMonthlyCents: 20000,
      plannedMonthlyCents: 25000,
      planSource: 'USER',
      projectedCompletionDate: '2027-04-01',
      status: 'ON_TRACK',
    });
  });

  it('rounds the required amount up', () => {
    const { goalPlans } = planGoals(
      [goal({ targetCents: 100, deadline: d('2027-02-01') })],
      surplus(1000),
      today,
    );
    expect(goalPlans[0].requiredMonthlyCents).toBe(34);
  });

  it('flags AT_RISK, UNREALISTIC, DONE, NO_DEADLINE and overdue', () => {
    const { goalPlans, goalPlanSummary } = planGoals(
      [
        goal({ id: 'risk', deadline: d('2027-05-01'), monthlyPlanCents: 100 }),
        goal({ id: 'big', deadline: d('2026-12-01'), targetCents: 900000 }),
        goal({ id: 'done', savedCents: 120000 }),
        goal({ id: 'free' }),
        goal({ id: 'late', deadline: d('2026-10-01') }),
      ],
      surplus(50000),
      today,
    );
    const status = Object.fromEntries(
      goalPlans.map((p) => [p.goalId, p.status]),
    );
    expect(status).toEqual({
      risk: 'AT_RISK',
      big: 'UNREALISTIC',
      done: 'DONE',
      free: 'NO_DEADLINE',
      late: 'UNREALISTIC',
    });
    expect(goalPlanSummary.overdueGoalIds).toEqual(['late']);
    expect(goalPlans.find((p) => p.goalId === 'late')).toMatchObject({
      monthsLeft: 0,
      requiredMonthlyCents: 120000,
      overdue: true,
    });
  });

  it('splits the surplus by deadline urgency, then evenly to the rest', () => {
    const { goalPlans, goalPlanSummary } = planGoals(
      [
        goal({ id: 'later', deadline: d('2027-11-01') }), // 12 meses: 10000
        goal({ id: 'soon', deadline: d('2027-01-01') }), // 2 meses: 60000
        goal({ id: 'a', targetCents: 5000 }),
        goal({ id: 'b' }),
      ],
      surplus(80000),
      today,
    );
    expect(goalPlanSummary.suggestedSplit).toEqual([
      { goalId: 'soon', suggestedMonthlyCents: 60000 },
      { goalId: 'later', suggestedMonthlyCents: 10000 },
      { goalId: 'a', suggestedMonthlyCents: 5000 },
      { goalId: 'b', suggestedMonthlyCents: 5000 },
    ]);
    expect(goalPlanSummary).toMatchObject({
      totalRequiredMonthlyCents: 70000,
      allocationRealistic: true,
      shortfallCents: 0,
    });
    expect(goalPlans.find((p) => p.goalId === 'later')).toMatchObject({
      planSource: 'SUGGESTED',
      status: 'ON_TRACK',
    });
  });

  it('reports the shortfall when the deadlines need more than the surplus', () => {
    const { goalPlans, goalPlanSummary } = planGoals(
      [
        goal({ id: 'soon', deadline: d('2027-01-01') }), // 60000
        goal({ id: 'later', deadline: d('2027-05-01') }), // 20000
      ],
      surplus(65000),
      today,
    );
    expect(goalPlanSummary).toMatchObject({
      totalRequiredMonthlyCents: 80000,
      availableMonthlyCents: 65000,
      allocationRealistic: false,
      shortfallCents: 15000,
    });
    expect(goalPlans.map((p) => [p.goalId, p.suggestedMonthlyCents])).toEqual([
      ['soon', 60000],
      ['later', 5000],
    ]);
    expect(goalPlans[1].status).toBe('AT_RISK');
  });

  it('a negative surplus leaves nothing to split', () => {
    const { goalPlanSummary } = planGoals(
      [goal({ deadline: d('2027-05-01'), monthlyPlanCents: 1000 })],
      surplus(-5000),
      today,
    );
    expect(goalPlanSummary).toMatchObject({
      availableMonthlyCents: 0,
      totalPlannedMonthlyCents: 1000,
      planRealistic: false,
      shortfallCents: 20000,
    });
  });
});
