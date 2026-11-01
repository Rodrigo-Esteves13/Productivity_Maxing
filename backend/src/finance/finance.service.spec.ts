import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  FinanceEntryKind,
  FinanceFrequency,
  FinancePayDayRule,
} from '@prisma/client';
import {
  FinanceService,
  computeBalances,
  heldByEmployer,
  monthBounds,
  overlappingEntriesWhere,
  parseDay,
  resolveOwed,
  resolveRequestKey,
  resolveRule,
  withOwed,
  summarize,
} from './finance.service';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { FinancePricesService } from './finance-prices.service';
import {
  CreateFinanceEntryDto,
  UpdateFinanceEntryDto,
  UpdateFinanceGoalDto,
} from './dto/finance.dto';
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
    skipFirstOccurrences: 0,
    paidInArrearsMonths: 0,
    withheldCents: null,
  };

  it('includes repeating entries that started before the month', async () => {
    const { service, prisma } = setup();
    const result = await service.summary('me', '2026-10', today);
    expect(prisma.financeEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        // Comeca 3 meses antes: historico dos planos dos objetivos.
        where: overlappingEntriesWhere(
          'me',
          new Date('2026-07-01T00:00:00Z'),
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

describe('FinanceService idempotency and plans', () => {
  const KEY = '00000000-0000-4000-8000-000000000001';
  const body = {
    kind: FinanceEntryKind.EXPENSE,
    amountCents: 100,
    category: 'CAFE',
    date: '2026-10-01',
  };
  function setup() {
    const prisma = {
      financeSettings: { findUnique: jest.fn().mockResolvedValue(null) },
      financeAccount: { findMany: jest.fn().mockResolvedValue([]) },
      financeHolding: { findMany: jest.fn().mockResolvedValue([]) },
      financeEntry: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'new' }),
        count: jest.fn().mockResolvedValue(0),
      },
      financeGoal: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirstOrThrow: jest.fn().mockResolvedValue({ id: 'g1' }),
      },
    };
    const service = new FinanceService(
      prisma as unknown as PrismaService,
      {} as FinancePricesService,
    );
    return { prisma, service };
  }

  it('a repeated key returns the row already created, scoped to the user', async () => {
    const { prisma, service } = setup();
    const existing = { id: 'e1', createdAt: new Date() };
    prisma.financeEntry.findFirst.mockResolvedValue(existing);
    await expect(
      service.createEntry('me', { ...body, clientRequestId: KEY }),
    ).resolves.toBe(existing);
    expect(prisma.financeEntry.findFirst).toHaveBeenCalledWith({
      where: { userId: 'me', clientRequestId: KEY },
    });
    expect(prisma.financeEntry.create).not.toHaveBeenCalled();
  });

  it('stores the key from the header on create', async () => {
    const { prisma, service } = setup();
    await service.createEntry('me', body, KEY);
    expect(prisma.financeEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'me',
        clientRequestId: KEY,
      }) as unknown,
    });
  });

  it('two requests at once: the loser reads the winner', async () => {
    const { prisma, service } = setup();
    const winner = { id: 'e1', createdAt: new Date() };
    prisma.financeEntry.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(winner);
    prisma.financeEntry.create.mockRejectedValue({ code: 'P2002' });
    await expect(service.createEntry('me', body, KEY)).resolves.toBe(winner);
  });

  it('a key reused after the window is a conflict', async () => {
    const { prisma, service } = setup();
    prisma.financeEntry.findFirst.mockResolvedValue({
      id: 'e1',
      createdAt: new Date('2000-01-01T00:00:00Z'),
    });
    await expect(service.createEntry('me', body, KEY)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rejects a bad header or a header that disagrees with the body', () => {
    expect(() => resolveRequestKey('nope', undefined)).toThrow(
      BadRequestException,
    );
    expect(() =>
      resolveRequestKey(KEY, '00000000-0000-4000-8000-000000000000'),
    ).toThrow(BadRequestException);
    expect(resolveRequestKey(undefined, KEY)).toBe(KEY);
    expect(resolveRequestKey(undefined, undefined)).toBeUndefined();
  });

  it('edits the kind and monthly plan of a goal', async () => {
    const { prisma, service } = setup();
    await service.updateGoal('me', 'g1', {
      kind: 'WISHLIST',
      monthlyPlanCents: null,
      name: 'Bike',
    });
    expect(prisma.financeGoal.updateMany).toHaveBeenCalledWith({
      where: { id: 'g1', userId: 'me' },
      data: { kind: 'WISHLIST', monthlyPlanCents: null, name: 'Bike' },
    });
  });

  it('summary carries goal plans and money held by the employer', async () => {
    const { prisma, service } = setup();
    prisma.financeEntry.findMany.mockResolvedValue([
      {
        id: 'job',
        kind: FinanceEntryKind.INCOME,
        amountCents: 80000,
        category: 'SALARY',
        note: 'Job',
        date: parseDateKey('2026-09-30'),
        recurring: true,
        frequency: FinanceFrequency.MONTHLY,
        payDayRule: null,
        payDay: null,
        endDate: null,
        accountId: null,
        skipFirstOccurrences: 0,
        paidInArrearsMonths: 0,
        withheldCents: 40000,
        createdAt: new Date(),
      },
    ]);
    prisma.financeGoal.findMany.mockResolvedValue([
      {
        id: 'g1',
        targetCents: 60000,
        savedCents: 0,
        deadline: parseDateKey('2027-01-15'),
        monthlyPlanCents: null,
        createdAt: new Date(),
      },
    ]);
    const result = await service.summary(
      'me',
      '2026-10',
      parseDateKey('2026-10-15'),
    );
    expect(result.heldByEmployer.totalCents).toBe(40000);
    expect(result.occurrences).toEqual([
      expect.objectContaining({ date: '2026-10-30', reason: 'REGULAR' }),
    ]);
    expect(result.goalPlans[0]).toMatchObject({
      goalId: 'g1',
      monthsLeft: 3,
      requiredMonthlyCents: 20000,
      suggestedMonthlyCents: 20000,
      status: 'ON_TRACK',
    });
    // Um so mes de dados (setembro, com a retencao): usa a regra mensal.
    expect(result.goalPlanSummary.surplus).toEqual({
      monthlyCents: 80000,
      source: 'RECURRING',
      monthsOfData: 1,
      lowConfidence: true,
    });
  });
});

describe('heldByEmployer', () => {
  const job = {
    id: 'job',
    kind: FinanceEntryKind.INCOME,
    amountCents: 80000,
    category: 'SALARY',
    note: null,
    date: parseDateKey('2026-09-30'),
    recurring: true,
    frequency: FinanceFrequency.MONTHLY,
    payDayRule: null,
    payDay: null,
    endDate: null as Date | null,
    accountId: null,
    skipFirstOccurrences: 0,
    paidInArrearsMonths: 0,
    withheldCents: 40000,
    isOwed: false,
    receivedAt: null,
  };

  it('counts money already withheld and not yet released', () => {
    expect(heldByEmployer([job], parseDateKey('2026-10-01'))).toEqual({
      totalCents: 40000,
      items: [
        {
          entryId: 'job',
          note: null,
          withheldCents: 40000,
          since: '2026-09-30',
          releaseDate: null,
        },
      ],
    });
  });

  it('ignores it before the first pay and from the release day on', () => {
    expect(heldByEmployer([job], parseDateKey('2026-09-29')).totalCents).toBe(
      0,
    );
    expect(
      heldByEmployer(
        [{ ...job, endDate: parseDateKey('2026-12-15') }],
        parseDateKey('2026-12-15'),
      ).totalCents,
    ).toBe(0);
  });
});

describe('resolveRule income fields', () => {
  const none = {
    date: new Date(0),
    frequency: null,
    payDayRule: null,
    payDay: null,
    endDate: null,
  };
  const salary = {
    kind: FinanceEntryKind.INCOME,
    date: '2026-10-01',
    frequency: FinanceFrequency.MONTHLY,
  };

  it('accepts skip, arrears and withholding on a monthly income', () => {
    expect(
      resolveRule(
        {
          ...salary,
          skipFirstOccurrences: 1,
          paidInArrearsMonths: 1,
          withheldCents: 40000,
        },
        none,
      ),
    ).toMatchObject({
      skipFirstOccurrences: 1,
      paidInArrearsMonths: 1,
      withheldCents: 40000,
    });
  });

  it('rejects them where they make no sense', () => {
    expect(() =>
      resolveRule({ date: '2026-10-01', skipFirstOccurrences: 1 }, none),
    ).toThrow(BadRequestException);
    expect(() =>
      resolveRule(
        {
          ...salary,
          frequency: FinanceFrequency.WEEKLY,
          paidInArrearsMonths: 1,
        },
        none,
      ),
    ).toThrow(BadRequestException);
    expect(() =>
      resolveRule(
        { ...salary, kind: FinanceEntryKind.EXPENSE, withheldCents: 5 },
        none,
      ),
    ).toThrow(BadRequestException);
  });

  it('keeps existing values on edit and clears them for a one-off', () => {
    const existing = {
      ...none,
      kind: FinanceEntryKind.INCOME,
      date: parseDateKey('2026-01-01'),
      frequency: FinanceFrequency.MONTHLY,
      skipFirstOccurrences: 2,
      paidInArrearsMonths: 1,
      withheldCents: 300,
    };
    expect(resolveRule({ amountCents: 500 }, existing)).toMatchObject({
      skipFirstOccurrences: 2,
      paidInArrearsMonths: 1,
      withheldCents: 300,
    });
    expect(resolveRule({ withheldCents: null }, existing)).toMatchObject({
      withheldCents: null,
    });
    expect(resolveRule({ frequency: null }, existing)).toMatchObject({
      skipFirstOccurrences: 0,
      paidInArrearsMonths: 0,
      withheldCents: null,
    });
  });

  it('rejects withholding above the amount (create and edit)', () => {
    expect(() =>
      resolveRule({ ...salary, amountCents: 1000, withheldCents: 1001 }, none),
    ).toThrow(BadRequestException);
    expect(
      resolveRule({ ...salary, amountCents: 1000, withheldCents: 1000 }, none),
    ).toMatchObject({ withheldCents: 1000 });
    const existing = {
      ...none,
      kind: FinanceEntryKind.INCOME,
      date: parseDateKey('2026-01-01'),
      frequency: FinanceFrequency.MONTHLY,
      amountCents: 1000,
      withheldCents: 800,
    };
    // Baixar o valor para menos do que o retido tambem e recusado.
    expect(() => resolveRule({ amountCents: 500 }, existing)).toThrow(
      BadRequestException,
    );
    expect(() => resolveRule({ withheldCents: 1500 }, existing)).toThrow(
      BadRequestException,
    );
  });
});

describe('resolveOwed', () => {
  const rule = { date: parseDateKey('2026-10-01'), frequency: null };
  const income = { kind: FinanceEntryKind.INCOME };

  it('needs a one-off INCOME', () => {
    expect(() =>
      resolveOwed({ isOwed: true }, { kind: FinanceEntryKind.EXPENSE }, rule),
    ).toThrow(BadRequestException);
    expect(() =>
      resolveOwed({ isOwed: true }, income, {
        ...rule,
        frequency: FinanceFrequency.MONTHLY,
      }),
    ).toThrow(BadRequestException);
  });

  it('needs a due date when there is interest', () => {
    expect(() =>
      resolveOwed({ isOwed: true, interestRatePct: 4.5 }, income, rule),
    ).toThrow(BadRequestException);
    expect(
      resolveOwed(
        { isOwed: true, interestRatePct: 4.5, expectedDate: '2027-01-01' },
        income,
        rule,
      ),
    ).toMatchObject({ isOwed: true, interestRatePct: 4.5 });
  });

  it('rejects owed fields without isOwed and clears them when it goes off', () => {
    expect(() => resolveOwed({ debtorName: 'Ana' }, income, rule)).toThrow(
      BadRequestException,
    );
    expect(
      resolveOwed(
        { isOwed: false },
        { ...income, isOwed: true, debtorName: 'Ana' },
        rule,
      ),
    ).toMatchObject({ isOwed: false, debtorName: null });
  });

  it('marking it received moves the entry to that day', () => {
    const existing = {
      ...income,
      isOwed: true,
      debtorName: 'Ana',
      expectedDate: parseDateKey('2026-12-01'),
      receivedAt: null,
    };
    expect(
      resolveOwed({ receivedAt: '2026-11-20' }, existing, rule),
    ).toMatchObject({
      date: parseDateKey('2026-11-20'),
      receivedAt: parseDateKey('2026-11-20'),
      debtorName: 'Ana',
    });
    expect(() =>
      resolveOwed({ receivedAt: '2026-09-01' }, existing, rule),
    ).toThrow(BadRequestException);
  });
});

describe('owed money in the summary', () => {
  const loanRow = {
    id: 'loan',
    kind: FinanceEntryKind.INCOME,
    amountCents: 50000,
    category: 'OTHER',
    note: null,
    date: parseDateKey('2026-10-01'),
    recurring: false,
    frequency: null,
    payDayRule: null,
    payDay: null,
    endDate: null,
    accountId: null,
    skipFirstOccurrences: 0,
    paidInArrearsMonths: 0,
    withheldCents: null,
    isOwed: true,
    debtorName: 'Ana',
    expectedDate: parseDateKey('2026-10-20'),
    latePaymentRiskPct: 40,
    interestRatePct: null,
    interestKind: null,
    receivedAt: null,
    createdAt: new Date(),
  };

  it('never counts in totals or the main projection, only in projectionWithOwed', async () => {
    const prisma = {
      financeSettings: { findUnique: jest.fn().mockResolvedValue(null) },
      financeAccount: { findMany: jest.fn().mockResolvedValue([]) },
      financeHolding: { findMany: jest.fn().mockResolvedValue([]) },
      financeEntry: { findMany: jest.fn().mockResolvedValue([loanRow]) },
      financeGoal: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new FinanceService(
      prisma as unknown as PrismaService,
      {} as FinancePricesService,
    );
    const result = await service.summary(
      'me',
      '2026-10',
      parseDateKey('2026-10-15'),
    );
    expect(prisma.financeEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'me', isOwed: true, receivedAt: null },
      }),
    );
    expect(result.occurrences).toEqual([]);
    expect(result.totals.incomeCents).toBe(0);
    expect(result.projection.projectedBalanceCents).toBe(0);
    expect(result.owed).toMatchObject({
      totalOwedCents: 50000,
      totalRiskWeightedCents: 30000,
      overdueCount: 0,
    });
    expect(result.projectionWithOwed).toMatchObject({
      owedRiskWeightedCents: 30000,
      projectedBalanceCents: 30000,
    });
  });

  it('withOwed leaves out debts due after the projected month', () => {
    const items = [
      { expectedDate: '2026-12-01', expectedValueCents: 100 },
      { expectedDate: null, expectedValueCents: 100 },
      { expectedDate: '2026-10-31', expectedValueCents: 7 },
    ] as never;
    expect(
      withOwed({ untilDate: '2026-10-31', projectedBalanceCents: 10 }, items),
    ).toMatchObject({ owedRiskWeightedCents: 7, projectedBalanceCents: 17 });
  });
});

describe('finance DTOs', () => {
  const errorsOf = async (cls: new () => object, body: object) =>
    (
      await validate(plainToInstance(cls, body), {
        whitelist: true,
        forbidNonWhitelisted: true,
      })
    )
      .map((e) => e.property)
      .sort();

  it('update DTOs accept the new fields but not clientRequestId', async () => {
    expect(
      await errorsOf(UpdateFinanceGoalDto, {
        kind: 'WISHLIST',
        monthlyPlanCents: null,
      }),
    ).toEqual([]);
    expect(
      await errorsOf(UpdateFinanceEntryDto, {
        clientRequestId: '00000000-0000-4000-8000-000000000001',
      }),
    ).toEqual(['clientRequestId']);
  });

  it('create DTOs validate the key, percentages and rate', async () => {
    expect(
      await errorsOf(CreateFinanceEntryDto, {
        kind: 'INCOME',
        amountCents: 100,
        category: 'OTHER',
        date: '2026-10-01',
        clientRequestId: 'not-a-uuid',
        latePaymentRiskPct: 101,
        interestRatePct: 4.1234,
        skipFirstOccurrences: -1,
      }),
    ).toEqual([
      'clientRequestId',
      'interestRatePct',
      'latePaymentRiskPct',
      'skipFirstOccurrences',
    ]);
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
