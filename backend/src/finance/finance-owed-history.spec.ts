import { FinanceService } from './finance.service';
import { OWED_PAYMENTS_HISTORY_LIMIT } from './finance.constants';
import type { FinancePricesService } from './finance-prices.service';
import type { PrismaService } from '../prisma/prisma.service';

describe('FinanceService.listOwedPayments', () => {
  const findMany = jest.fn();
  const service = new FinanceService(
    { financeOwedPayment: { findMany } } as unknown as PrismaService,
    {} as FinancePricesService,
  );

  beforeEach(() => {
    findMany.mockReset();
  });

  it('filters by userId, orders newest first and caps the list', async () => {
    findMany.mockResolvedValue([]);
    await service.listOwedPayments('user-1');
    const args = findMany.mock.calls[0][0] as {
      where: { userId: string };
      orderBy: { paidAt?: string }[];
      take: number;
    };
    expect(args.where).toEqual({ userId: 'user-1' });
    expect(args.orderBy[0]).toEqual({ paidAt: 'desc' });
    expect(args.take).toBe(OWED_PAYMENTS_HISTORY_LIMIT);
  });

  it('maps rows to date keys and keeps a missing debtor name as null', async () => {
    findMany.mockResolvedValue([
      {
        id: 'a',
        debtorName: 'Ana',
        amountCents: 500,
        paidAt: new Date('2026-03-02T00:00:00Z'),
      },
      {
        id: 'b',
        debtorName: null,
        amountCents: 100,
        paidAt: new Date('2026-03-01T00:00:00Z'),
      },
    ]);
    expect(await service.listOwedPayments('user-1')).toEqual([
      { id: 'a', debtorName: 'Ana', amountCents: 500, paidAt: '2026-03-02' },
      { id: 'b', debtorName: null, amountCents: 100, paidAt: '2026-03-01' },
    ]);
  });
});
