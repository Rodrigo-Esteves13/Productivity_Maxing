import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FinanceEntryKind } from '@prisma/client';
import { FinanceService, monthBounds, summarize } from './finance.service';
import type { PrismaService } from '../prisma/prisma.service';

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

describe('FinanceService', () => {
  function setup() {
    const prisma = {
      financeSettings: { findUnique: jest.fn().mockResolvedValue(null) },
      financeEntry: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      financeGoal: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    return {
      prisma,
      service: new FinanceService(prisma as unknown as PrismaService),
    };
  }

  it('includes monthly entries that started before the month', async () => {
    const { service, prisma } = setup();
    const result = await service.summary('me', '2026-10');
    expect(prisma.financeEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'me',
          OR: [
            {
              date: {
                gte: new Date('2026-10-01T00:00:00Z'),
                lt: new Date('2026-11-01T00:00:00Z'),
              },
            },
            { recurring: true, date: { lt: new Date('2026-10-01T00:00:00Z') } },
          ],
        },
      }),
    );
    expect(result.settings.currency).toBe('EUR');
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
});
