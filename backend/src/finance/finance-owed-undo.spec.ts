import { ConflictException, NotFoundException } from '@nestjs/common';
import { FinanceEntryKind, FinanceInterestKind, Prisma } from '@prisma/client';
import { FinanceService } from './finance.service';
import type { FinancePricesService } from './finance-prices.service';
import type { PrismaService } from '../prisma/prisma.service';
import {
  buildSettledDebtSnapshot,
  parseSettledDebtSnapshot,
  restoredDebtData,
  type SettledDebtSnapshot,
} from './finance-owed-undo.util';
import {
  MAX_FINANCE_ENTRIES_PER_USER,
  SETTLED_DEBT_SNAPSHOT_VERSION,
} from './finance.constants';

const PAYMENT_ID = '22222222-2222-4222-8222-222222222222';

const debtSource = {
  id: 'd1',
  category: 'OTHER',
  note: 'loan',
  debtorName: 'Ana',
  date: new Date('2026-10-01T00:00:00Z'),
  expectedDate: new Date('2026-12-01T00:00:00Z'),
  latePaymentRiskPct: 20,
  interestRatePct: new Prisma.Decimal('4.5'),
  interestKind: FinanceInterestKind.SIMPLE,
  accountId: 'a1',
};

const snapshot: SettledDebtSnapshot = buildSettledDebtSnapshot(debtSource, [
  'p0',
]);

interface PaymentRow {
  entryId: string | null;
  incomeEntryId: string | null;
  amountCents: number;
  settledDebt: unknown;
}

const linkedPartial: PaymentRow = {
  entryId: 'd1',
  incomeEntryId: 'inc1',
  amountCents: 2500,
  settledDebt: null,
};

function setup(payment: PaymentRow | null = linkedPartial) {
  const tx = {
    financeOwedPayment: {
      findFirst: jest.fn().mockResolvedValue(payment),
      deleteMany: jest.fn().mockResolvedValue({ count: payment ? 1 : 0 }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    financeEntry: {
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findFirst: jest.fn().mockResolvedValue({ amountCents: 10000 }),
      create: jest.fn().mockResolvedValue({ id: 'd1' }),
      count: jest.fn().mockResolvedValue(1),
    },
    financeAccount: {
      findFirst: jest.fn().mockResolvedValue({ id: 'a1' }),
    },
  };
  const prisma = {
    ...tx,
    $transaction: jest.fn((fn: (client: typeof tx) => Promise<unknown>) =>
      fn(tx),
    ),
  };
  const service = new FinanceService(
    prisma as unknown as PrismaService,
    {} as FinancePricesService,
  );
  return { prisma, tx, service };
}

describe('FinanceService.undoOwedPayment', () => {
  it('404 for a foreign or unknown payment, scoped by userId, no writes', async () => {
    const { tx, service } = setup(null);
    await expect(
      service.undoOwedPayment('u2', PAYMENT_ID),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.financeOwedPayment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: PAYMENT_ID, userId: 'u2' } }),
    );
    expect(tx.financeOwedPayment.deleteMany).not.toHaveBeenCalled();
    expect(tx.financeEntry.deleteMany).not.toHaveBeenCalled();
    expect(tx.financeEntry.updateMany).not.toHaveBeenCalled();
  });

  it('partial payment: in one transaction deletes payment and income, gives the amount back', async () => {
    const { prisma, tx, service } = setup();
    const res = await service.undoOwedPayment('u1', PAYMENT_ID);
    expect(res).toEqual({
      incomeEntryRemoved: true,
      debtRestored: true,
      remainingCents: 10000,
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.financeOwedPayment.deleteMany).toHaveBeenCalledWith({
      where: { id: PAYMENT_ID, userId: 'u1' },
    });
    expect(tx.financeEntry.deleteMany).toHaveBeenCalledWith({
      where: { id: 'inc1', userId: 'u1' },
    });
    expect(tx.financeEntry.updateMany).toHaveBeenCalledWith({
      where: { id: 'd1', userId: 'u1', isOwed: true, receivedAt: null },
      data: { amountCents: { increment: 2500 } },
    });
    expect(tx.financeEntry.create).not.toHaveBeenCalled();
  });

  it('409 (whole transaction rejects) when the debt was marked as received', async () => {
    const { tx, service } = setup();
    tx.financeEntry.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      service.undoOwedPayment('u1', PAYMENT_ID),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('settling payment: recreates the debt from the snapshot and relinks earlier payments', async () => {
    const { tx, service } = setup({
      entryId: null,
      incomeEntryId: 'inc9',
      amountCents: 7500,
      settledDebt: snapshot,
    });
    const res = await service.undoOwedPayment('u1', PAYMENT_ID);
    expect(res).toEqual({
      incomeEntryRemoved: true,
      debtRestored: true,
      remainingCents: 7500,
    });
    expect(tx.financeEntry.deleteMany).toHaveBeenCalledWith({
      where: { id: 'inc9', userId: 'u1' },
    });
    expect(tx.financeAccount.findFirst).toHaveBeenCalledWith({
      where: { id: 'a1', userId: 'u1' },
      select: { id: true },
    });
    expect(tx.financeEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: 'd1',
        userId: 'u1',
        kind: FinanceEntryKind.INCOME,
        isOwed: true,
        amountCents: 7500,
        debtorName: 'Ana',
        accountId: 'a1',
      }) as unknown,
      select: { id: true },
    });
    expect(tx.financeOwedPayment.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', id: { in: ['p0'] }, entryId: null },
      data: { entryId: 'd1' },
    });
  });

  it('settling payment: a deleted account is not relinked', async () => {
    const { tx, service } = setup({
      entryId: null,
      incomeEntryId: 'inc9',
      amountCents: 7500,
      settledDebt: snapshot,
    });
    tx.financeAccount.findFirst.mockResolvedValueOnce(null);
    await service.undoOwedPayment('u1', PAYMENT_ID);
    expect(tx.financeEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ accountId: null }) as unknown,
      }),
    );
  });

  it('settling payment: rejects at the entry cap', async () => {
    const { tx, service } = setup({
      entryId: null,
      incomeEntryId: null,
      amountCents: 7500,
      settledDebt: snapshot,
    });
    tx.financeEntry.count.mockResolvedValueOnce(
      MAX_FINANCE_ENTRIES_PER_USER + 1,
    );
    await expect(service.undoOwedPayment('u1', PAYMENT_ID)).rejects.toThrow(
      `You can have at most ${MAX_FINANCE_ENTRIES_PER_USER} entries.`,
    );
  });

  it('historical unlinked payment: only the payment row goes, nothing guessed', async () => {
    const { tx, service } = setup({
      entryId: null,
      incomeEntryId: null,
      amountCents: 3000,
      settledDebt: null,
    });
    const res = await service.undoOwedPayment('u1', PAYMENT_ID);
    expect(res).toEqual({
      incomeEntryRemoved: false,
      debtRestored: false,
      remainingCents: null,
    });
    expect(tx.financeOwedPayment.deleteMany).toHaveBeenCalledTimes(1);
    expect(tx.financeEntry.deleteMany).not.toHaveBeenCalled();
    expect(tx.financeEntry.updateMany).not.toHaveBeenCalled();
    expect(tx.financeEntry.create).not.toHaveBeenCalled();
  });

  it('historical payment on an open debt: restores principal, reports income not found', async () => {
    const { tx, service } = setup({ ...linkedPartial, incomeEntryId: null });
    const res = await service.undoOwedPayment('u1', PAYMENT_ID);
    expect(res.incomeEntryRemoved).toBe(false);
    expect(res.debtRestored).toBe(true);
    expect(tx.financeEntry.deleteMany).not.toHaveBeenCalled();
  });

  it('income entry deleted by hand meanwhile: reported as not found', async () => {
    const { tx, service } = setup();
    tx.financeEntry.deleteMany.mockResolvedValueOnce({ count: 0 });
    const res = await service.undoOwedPayment('u1', PAYMENT_ID);
    expect(res.incomeEntryRemoved).toBe(false);
  });

  it('double delete: the second call is 404 with no side effects', async () => {
    const { tx, service } = setup();
    await service.undoOwedPayment('u1', PAYMENT_ID);
    tx.financeOwedPayment.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.undoOwedPayment('u1', PAYMENT_ID),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.financeOwedPayment.deleteMany).toHaveBeenCalledTimes(1);
    expect(tx.financeEntry.deleteMany).toHaveBeenCalledTimes(1);
    expect(tx.financeEntry.updateMany).toHaveBeenCalledTimes(1);
  });

  it('concurrent delete: the losing request gets 404 before touching entries', async () => {
    const { tx, service } = setup();
    tx.financeOwedPayment.deleteMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      service.undoOwedPayment('u1', PAYMENT_ID),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.financeEntry.deleteMany).not.toHaveBeenCalled();
    expect(tx.financeEntry.updateMany).not.toHaveBeenCalled();
  });
});

describe('settled debt snapshot', () => {
  it('round trips through JSON', () => {
    const parsed = parseSettledDebtSnapshot(
      JSON.parse(JSON.stringify(snapshot)),
    );
    expect(parsed).toEqual(snapshot);
    expect(parsed?.v).toBe(SETTLED_DEBT_SNAPSHOT_VERSION);
    expect(parsed?.interestRatePct).toBe('4.5');
  });

  it.each([
    ['null', null],
    ['array', []],
    ['other version', { ...snapshot, v: SETTLED_DEBT_SNAPSHOT_VERSION + 1 }],
    ['bad date', { ...snapshot, date: 'nope' }],
    ['bad interest kind', { ...snapshot, interestKind: 'WEEKLY' }],
    ['bad payment ids', { ...snapshot, paymentIds: [1] }],
    ['missing id', { ...snapshot, id: undefined }],
  ])('rejects %s', (_name, raw) => {
    expect(parseSettledDebtSnapshot(raw)).toBeNull();
  });

  it('restoredDebtData builds an open owed INCOME entry', () => {
    const data = restoredDebtData(snapshot, 'u1', 1234, null);
    expect(data).toMatchObject({
      id: 'd1',
      userId: 'u1',
      kind: FinanceEntryKind.INCOME,
      amountCents: 1234,
      isOwed: true,
      accountId: null,
      date: debtSource.date,
      expectedDate: debtSource.expectedDate,
      latePaymentRiskPct: 20,
      interestKind: FinanceInterestKind.SIMPLE,
    });
    expect(data.interestRatePct).toEqual(new Prisma.Decimal('4.5'));
    expect(data).not.toHaveProperty('receivedAt');
  });
});
