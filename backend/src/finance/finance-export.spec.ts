import { FinanceEntryKind } from '@prisma/client';
import { FinanceService } from './finance.service';
import { MAX_FINANCE_ENTRIES_PER_USER } from './finance.constants';
import type { FinancePricesService } from './finance-prices.service';
import type { PrismaService } from '../prisma/prisma.service';

describe('FinanceService.exportAll', () => {
  function setup() {
    const prisma = {
      financeSettings: {
        findUnique: jest.fn().mockResolvedValue({ currency: 'USD' }),
      },
      financeAccount: {
        findMany: jest.fn().mockResolvedValue([{ id: 'a1', name: 'Bank' }]),
      },
      financeEntry: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'e1',
            kind: FinanceEntryKind.INCOME,
            amountCents: 1500,
            category: 'SALARY',
            note: null,
            date: new Date('2026-03-05T00:00:00Z'),
            recurring: true,
            frequency: null,
            accountId: 'a1',
            isOwed: false,
            debtorName: null,
            receivedAt: null,
          },
        ]),
      },
      financeOwedPayment: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'p1',
            entryId: 'e2',
            debtorName: 'Ana',
            amountCents: 500,
            paidAt: new Date('2026-04-01T00:00:00Z'),
          },
        ]),
      },
    };
    const service = new FinanceService(
      prisma as unknown as PrismaService,
      {} as unknown as FinancePricesService,
    );
    return { prisma, service };
  }

  it('scopes every query to the user and caps the rows', async () => {
    const { prisma, service } = setup();
    await service.exportAll('u1');
    expect(prisma.financeSettings.findUnique.mock.calls[0][0].where).toEqual({
      userId: 'u1',
    });
    expect(prisma.financeAccount.findMany.mock.calls[0][0].where).toEqual({
      userId: 'u1',
    });
    const entryArgs = prisma.financeEntry.findMany.mock.calls[0][0];
    expect(entryArgs.where).toEqual({ userId: 'u1' });
    // Uma linha a mais para saber se cortou.
    expect(entryArgs.take).toBe(MAX_FINANCE_ENTRIES_PER_USER + 1);
    const payArgs = prisma.financeOwedPayment.findMany.mock.calls[0][0];
    expect(payArgs.where).toEqual({ userId: 'u1' });
    expect(payArgs.take).toBe(MAX_FINANCE_ENTRIES_PER_USER + 1);
  });

  it('maps dates to day keys and resolves the legacy recurring flag', async () => {
    const { service } = setup();
    const out = await service.exportAll('u1');
    expect(out.currency).toBe('USD');
    expect(out.entries[0].date).toBe('2026-03-05');
    expect(out.entries[0].frequency).toBe('MONTHLY');
    expect(out.owedPayments[0].paidAt).toBe('2026-04-01');
    expect(out.truncated).toBe(false);
  });

  it('reports truncated and drops the extra row when entries hit the cap', async () => {
    const { prisma, service } = setup();
    const rows = (await prisma.financeEntry.findMany()) as object[];
    prisma.financeEntry.findMany.mockResolvedValue(
      Array.from({ length: MAX_FINANCE_ENTRIES_PER_USER + 1 }, () => rows[0]),
    );
    const out = await service.exportAll('u1');
    expect(out.truncated).toBe(true);
    expect(out.entries).toHaveLength(MAX_FINANCE_ENTRIES_PER_USER);
  });

  it('reports truncated when only the payments hit the cap', async () => {
    const { prisma, service } = setup();
    const rows = (await prisma.financeOwedPayment.findMany()) as object[];
    prisma.financeOwedPayment.findMany.mockResolvedValue(
      Array.from({ length: MAX_FINANCE_ENTRIES_PER_USER + 1 }, () => rows[0]),
    );
    const out = await service.exportAll('u1');
    expect(out.truncated).toBe(true);
    expect(out.owedPayments).toHaveLength(MAX_FINANCE_ENTRIES_PER_USER);
  });
});
