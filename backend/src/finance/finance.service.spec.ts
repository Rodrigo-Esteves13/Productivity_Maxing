import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  FinanceEntryKind,
  FinanceFrequency,
  FinancePayDayRule,
} from '@prisma/client';
import {
  FinanceService,
  computeBalances,
  monthBounds,
  overlappingEntriesWhere,
  parseDay,
  resolveRule,
  summarize,
} from './finance.service';
import type { FinancePricesService } from './finance-prices.service';
import type { PrismaService } from '../prisma/prisma.service';
import { parseDateKey } from '../common/date-key.util';

describe('monthBounds', () => {
  it('covers the whole month, including December', () => {
    expect(monthBounds('2026-12')).toEqual({
      start: new Date('2026-12-01T00:00:00Z'),
      end: new Date('2027-01-01T00:00:00Z'),
    });
  });

  it('rejects anything that is not YYYY-MM', () => {
    expect(() => monthBounds('2026-13')).toThrow(BadRequestException);
    expect(() => monthBounds('')).toThrow(BadRequestException);
  });
});

describe('summarize', () => {
  it('adds income and expenses and counts leisure apart', () => {
    const totals = summarize([
      {
        kind: FinanceEntryKind.INCOME,
        amountCents: 100000,
        category: 'SALARY',
      },
      {
        kind: FinanceEntryKind.EXPENSE,
        amountCents: 30000,
        category: 'HOUSING',
      },
      {
        kind: FinanceEntryKind.EXPENSE,
        amountCents: 2500,
        category: 'LEISURE',
      },
    ]);
    expect(totals).toEqual({
      incomeCents: 100000,
      expenseCents: 32500,
      netCents: 67500,
      leisureCents: 2500,
      expensesByCategory: { HOUSING: 30000, LEISURE: 2500 },
    });
  });
});

describe('resolveRule', () => {
  const none = {
    date: new Date(0),
    frequency: null,
    payDayRule: null,
    payDay: null,
    endDate: null,
  };

  it('maps legacy recurring=true to MONTHLY', () => {
    expect(resolveRule({ date: '2026-10-01', recurring: true }, none)).toEqual(
      expect.objectContaining({
        frequency: FinanceFrequency.MONTHLY,
        recurring: true,
      }),
    );
  });

  it('rejects pay-day rules outside MONTHLY and endDate before date', () => {
    expect(() =>
      resolveRule(
        {
          date: '2026-10-01',
          frequency: FinanceFrequency.WEEKLY,
          payDayRule: FinancePayDayRule.LAST_FRIDAY,
        },
        none,
      ),
    ).toThrow(BadRequestException);
    expect(() =>
      resolveRule(
        {
          date: '2026-10-01',
          frequency: FinanceFrequency.MONTHLY,
          payDayRule: FinancePayDayRule.LAST_FRIDAY,
          payDay: 3,
        },
        none,
      ),
    ).toThrow(BadRequestException);
    expect(() =>
      resolveRule({ date: '2026-10-10', endDate: '2026-10-01' }, none),
    ).toThrow(BadRequestException);
  });

  it('clears pay-day fields when the frequency stops being monthly', () => {
    const existing = {
      ...none,
      date: parseDateKey('2026-01-01'),
      frequency: FinanceFrequency.MONTHLY,
      payDayRule: FinancePayDayRule.FIXED_DAY,
      payDay: 25,
    };
    expect(
      resolveRule({ frequency: FinanceFrequency.YEARLY }, existing),
    ).toMatchObject({ payDayRule: null, payDay: null, recurring: true });
  });
});

describe('computeBalances', () => {
  it('sums buckets, keeps other currencies apart, counts legacy as unassigned', () => {
    const b = computeBalances(
      'EUR',
      500,
      [
        { type: 'BANK', balanceCents: 10000, currency: null },
        { type: 'LIVE', balanceCents: 2000, currency: 'EUR' },
        { type: 'BANK', balanceCents: 9999, currency: 'USD' },
      ],
      [
        {
          bucket: 'INVESTMENT',
          valueCents: 11325,
          priceCurrency: 'EUR',
          costBasisCents: 11218,
          gainCents: 107,
        },
      ] as never,
    );
    expect(b.totalCents).toBe(500 + 10000 + 2000 + 11325);
    expect(b.cashCents).toBe(12500);
    expect(b.byType).toMatchObject({
      UNASSIGNED: 500,
      BANK: 10000,
      LIVE: 2000,
      INVESTMENT: 11325,
      CRYPTO: 0,
    });
    expect(b.otherCurrencies).toEqual({ USD: 9999 });
    expect(b.investments).toEqual({
      valueCents: 11325,
      costBasisCents: 11218,
      gainCents: 107,
    });
  });
});

describe('FinanceService', () => {
  function setup() {
    const tx = {
      financeSettings: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      financeAccount: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
      financeSettings: { findUnique: jest.fn().mockResolvedValue(null) },
      financeAccount: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      financeHolding: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: 'h1' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      financeEntry: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        count: jest.fn().mockResolvedValue(0),
      },
      financeGoal: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const prices = { quoteFor: jest.fn().mockResolvedValue(null) };
    return {
      prisma,
      tx,
      prices,
      service: new FinanceService(
        prisma as unknown as PrismaService,
        prices as unknown as FinancePricesService,
      ),
    };
  }
  const today = parseDateKey('2026-10-15');
  const netflix = {
    id: 'netflix',
    kind: FinanceEntryKind.EXPENSE,
    amountCents: 1299,
    category: 'SUBSCRIPTIONS',
    note: null,
    date: parseDateKey('2026-01-20'),
    recurring: true,
    frequency: null,
    payDayRule: null,
    payDay: null,
    endDate: null,
    accountId: null,
  };

  it('includes repeating entries that started before the month', async () => {
    const { service, prisma } = setup();
    const result = await service.summary('me', '2026-10', today);
    expect(prisma.financeEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: overlappingEntriesWhere(
          'me',
          new Date('2026-10-01T00:00:00Z'),
          new Date('2026-11-01T00:00:00Z'),
        ),
      }),
    );
    expect(result.settings.currency).toBe('EUR');
  });

  it('materialises scheduled occurrences and projects the month end', async () => {
    const { service, prisma } = setup();
    prisma.financeAccount.findMany.mockResolvedValue([
      { type: 'BANK', balanceCents: 100000, currency: null },
    ]);
    prisma.financeEntry.findMany.mockResolvedValue([netflix]);
    const result = await service.summary('me', '2026-10', today);
    expect(result.occurrences).toEqual([
      expect.objectContaining({ date: '2026-10-20', projected: true }),
    ]);
    expect(result.entries[0].frequency).toBe(FinanceFrequency.MONTHLY);
    expect(result.totals.expenseCents).toBe(1299);
    expect(result.actualTotals.expenseCents).toBe(0);
    expect(result.projection.projectedBalanceCents).toBe(100000 - 1299);
  });

  it('plans a future month from tomorrow onwards', async () => {
    const { service, prisma } = setup();
    prisma.financeEntry.findMany.mockResolvedValue([netflix]);
    const result = await service.summary('me', '2026-12', today);
    // Oct 20, Nov 20 e Dec 20 ainda por acontecer.
    expect(result.projection.remainingExpenseCents).toBe(3 * 1299);
    expect(result.projection.untilDate).toBe('2026-12-31');
  });

  it('moves the legacy balance into one BANK account, scoped to the user', async () => {
    const { service, prisma, tx } = setup();
    prisma.financeSettings.findUnique.mockResolvedValue({
      currency: 'EUR',
      balanceCents: 4200,
      monthlyBudgetCents: null,
      leisureBudgetCents: null,
    });
    await service.summary('me', '2026-10', today);
    expect(tx.financeSettings.updateMany).toHaveBeenCalledWith({
      where: { userId: 'me', balanceCents: 4200 },
      data: { balanceCents: 0 },
    });
    expect(tx.financeAccount.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'me',
        type: 'BANK',
        balanceCents: 4200,
      }) as unknown,
    });
  });

  it('creates a holding from an invested amount using the quote', async () => {
    const { service, prisma, prices } = setup();
    prices.quoteFor.mockResolvedValue({
      symbol: 'VWCE.DE',
      priceCents: 16840,
      currency: 'EUR',
      fetchedAt: new Date(),
    });
    prisma.financeHolding.findFirst.mockResolvedValue({
      id: 'h1',
      symbol: 'VWCE.DE',
      quantity: '0.666152',
      lastPriceCents: 16840,
      priceCurrency: 'EUR',
      costBasisCents: 11218,
      account: null,
    });
    const view = await service.createHolding('me', {
      symbol: 'VWCE.DE',
      investedCents: 11218,
    });
    expect(prisma.financeHolding.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'me',
        quantity: '0.666152',
        costBasisCents: 11218,
      }) as unknown,
    });
    expect(prisma.financeHolding.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'h1', userId: 'me' } }),
    );
    expect(view.percentOfFullShare).toBe(66.62);
    expect(view.fullSharePriceCents).toBe(16840);
  });

  it('rejects holdings with both or neither quantity and amount', async () => {
    const { service } = setup();
    await expect(
      service.createHolding('me', { symbol: 'X' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.createHolding('me', {
        symbol: 'X',
        quantity: '1',
        investedCents: 5,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not link an entry to an account of someone else', async () => {
    const { service, prisma } = setup();
    await expect(
      service.createEntry('me', {
        kind: FinanceEntryKind.EXPENSE,
        amountCents: 100,
        category: 'CAFE',
        date: '2026-10-01',
        accountId: 'other-users-account',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.financeAccount.count).toHaveBeenCalledWith({
      where: { id: 'other-users-account', userId: 'me' },
    });
  });

  it('only touches rows of the owner', async () => {
    const { service, prisma } = setup();
    await expect(service.removeEntry('me', 'e1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.financeEntry.deleteMany).toHaveBeenCalledWith({
      where: { id: 'e1', userId: 'me' },
    });
    await expect(
      service.updateGoal('me', 'g1', { savedCents: 5 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.financeGoal.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'g1', userId: 'me' } }),
    );
  });

  it('rejects an analytics range that is too long or reversed', async () => {
    const { service } = setup();
    await expect(
      service.analytics('me', { from: '2020-01-01', to: '2026-01-01' }, today),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.analytics('me', { from: '2026-05-01', to: '2026-04-01' }, today),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('analytics lists subscriptions with their monthly cost', async () => {
    const { service, prisma } = setup();
    prisma.financeEntry.findMany.mockResolvedValue([
      {
        ...netflix,
        id: 's1',
        amountCents: 12000,
        date: parseDateKey('2026-03-01'),
        frequency: FinanceFrequency.YEARLY,
      },
    ]);
    const result = await service.analytics('me', {}, today);
    expect(result.subscriptions).toEqual({
      items: [
        expect.objectContaining({
          entryId: 's1',
          monthlyCostCents: 1000,
          nextDate: '2027-03-01',
        }),
      ],
      monthlyTotalCents: 1000,
    });
    expect(result.from).toBe('2026-05-01');
    expect(result.to).toBe('2026-10-31');
    expect(result.series).toHaveLength(6);
    expect(result.projection.month).toBe('2026-10');
  });
  it('editing investedCents moves the cost basis with it', async () => {
    const { service, prisma } = setup();
    prisma.financeHolding.findFirst.mockResolvedValue({
      id: 'h1',
      symbol: 'VWCE.DE',
      quantity: '0.5',
      lastPriceCents: 10000,
      priceCurrency: 'EUR',
      costBasisCents: 5000,
      account: null,
    });
    await service.updateHolding('me', 'h1', { investedCents: 20000 });
    expect(prisma.financeHolding.updateMany).toHaveBeenCalledWith({
      where: { id: 'h1', userId: 'me' },
      data: expect.objectContaining({
        quantity: '2.000000',
        costBasisCents: 20000,
      }) as unknown,
    });
  });

  it('an explicit costBasisCents still wins over investedCents', async () => {
    const { service, prisma } = setup();
    prisma.financeHolding.findFirst.mockResolvedValue({
      id: 'h1',
      symbol: 'VWCE.DE',
      quantity: '0.5',
      lastPriceCents: 10000,
      priceCurrency: 'EUR',
      costBasisCents: 5000,
      account: null,
    });
    await service.updateHolding('me', 'h1', {
      investedCents: 20000,
      costBasisCents: 18000,
    });
    expect(prisma.financeHolding.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ costBasisCents: 18000 }) as unknown,
      }),
    );
  });

  it('rejects impossible analytics dates instead of skipping the range cap', async () => {
    const { service } = setup();
    await expect(
      service.analytics('me', { from: '2026-13-01', to: '2026-12-01' }, today),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.analytics('me', { from: '2000-01-01', to: '2026-99-99' }, today),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('parseDay', () => {
  it('accepts real days, including Feb 29 of a leap year', () => {
    expect(parseDay('2028-02-29', 'date')).toEqual(
      new Date('2028-02-29T00:00:00Z'),
    );
  });

  it('rejects days that do not exist or roll over', () => {
    for (const key of [
      '2026-13-01',
      '2026-02-31',
      '2027-02-29',
      '2026-00-10',
    ]) {
      expect(() => parseDay(key, 'date')).toThrow(BadRequestException);
    }
  });

  it('resolveRule rejects an impossible date or endDate', () => {
    const none = {
      date: new Date(0),
      frequency: null,
      payDayRule: null,
      payDay: null,
      endDate: null,
    };
    expect(() => resolveRule({ date: '2026-02-30' }, none)).toThrow(
      BadRequestException,
    );
    expect(() =>
      resolveRule(
        {
          date: '2026-01-01',
          frequency: FinanceFrequency.MONTHLY,
          endDate: '2026-04-31',
        },
        none,
      ),
    ).toThrow(BadRequestException);
  });
});
