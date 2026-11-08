import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { FinanceEntryKind } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FinanceService } from './finance.service';
import type { FinancePricesService } from './finance-prices.service';
import { CreateOwedPaymentDto } from './dto/finance.dto';
import { MAX_FINANCE_ENTRIES_PER_USER } from './finance.constants';
import type { PrismaService } from '../prisma/prisma.service';

const debt = {
  id: 'd1',
  userId: 'u1',
  amountCents: 10000,
  category: 'OTHER',
  debtorName: 'Ana',
  note: null,
  accountId: 'a1',
  date: new Date('2026-10-01T00:00:00Z'),
};

const KEY = '11111111-1111-4111-8111-111111111111';
const CREATED_AT = new Date('2026-10-05T10:00:00Z');

function setup(owed: typeof debt | null = debt) {
  const tx = {
    financeEntry: {
      findFirst: jest.fn().mockResolvedValue(owed),
      create: jest.fn().mockResolvedValue({ createdAt: CREATED_AT }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      count: jest.fn().mockResolvedValue(0),
    },
    financeOwedPayment: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    ...tx,
    // Interativa: o callback recebe os mesmos mocks como `tx`.
    $transaction: jest.fn((fn: (client: typeof tx) => Promise<unknown>) =>
      fn(tx),
    ),
  };
  const service = new FinanceService(
    prisma as unknown as PrismaService,
    {} as FinancePricesService,
  );
  return { prisma, service };
}

const unchanged = {
  id: 'd1',
  userId: 'u1',
  isOwed: true,
  receivedAt: null,
  amountCents: 10000,
};

describe('FinanceService.addOwedPayment', () => {
  it('throws NotFound for an unknown or foreign entry, scoped lookup', async () => {
    const { prisma, service } = setup(null);
    await expect(
      service.addOwedPayment('u1', 'd1', {
        amountCents: 100,
        paidAt: '2026-10-05',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.financeEntry.findFirst).toHaveBeenCalledWith({
      where: { id: 'd1', userId: 'u1', isOwed: true, receivedAt: null },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a payment dated before the debt', async () => {
    const { prisma, service } = setup();
    await expect(
      service.addOwedPayment('u1', 'd1', {
        amountCents: 100,
        paidAt: '2026-09-30',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('partial payment: creates income, payment with entryId, lowers principal', async () => {
    const { prisma, service } = setup();
    const res = await service.addOwedPayment('u1', 'd1', {
      amountCents: 2500,
      paidAt: '2026-10-05',
    });
    expect(res).toEqual({ remainingCents: 7500 });
    expect(prisma.financeEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'u1',
          kind: FinanceEntryKind.INCOME,
          amountCents: 2500,
          accountId: 'a1',
          clientRequestId: null,
        }) as unknown,
      }),
    );
    expect(prisma.financeOwedPayment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'u1',
        entryId: 'd1',
        amountCents: 2500,
      }) as unknown,
    });
    expect(prisma.financeEntry.updateMany).toHaveBeenCalledWith({
      where: unchanged,
      data: { amountCents: { decrement: 2500 } },
    });
    expect(prisma.financeEntry.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects an amount above the principal, nothing written', async () => {
    const { prisma, service } = setup();
    await expect(
      service.addOwedPayment('u1', 'd1', {
        amountCents: 10001,
        paidAt: '2026-10-05',
      }),
    ).rejects.toThrow(
      'Amount is above what is still owed as principal. Use Mark as received for the full amount.',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.financeEntry.create).not.toHaveBeenCalled();
  });

  it('payment equal to principal also settles the debt', async () => {
    const { prisma, service } = setup();
    const res = await service.addOwedPayment('u1', 'd1', {
      amountCents: 10000,
      paidAt: '2026-10-01',
    });
    expect(res).toEqual({ remainingCents: 0 });
    expect(prisma.financeEntry.deleteMany).toHaveBeenCalledWith({
      where: unchanged,
    });
    expect(prisma.financeOwedPayment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entryId: null,
        amountCents: 10000,
      }) as unknown,
    });
    expect(prisma.financeEntry.updateMany).not.toHaveBeenCalled();
  });

  it('race: the second concurrent payment gets 409 and creates no income', async () => {
    const { prisma, service } = setup();
    // Os dois leram o mesmo principal; so o primeiro encontra a linha igual.
    prisma.financeEntry.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    const pay = () =>
      service.addOwedPayment('u1', 'd1', {
        amountCents: 2500,
        paidAt: '2026-10-05',
      });
    const [first, second] = await Promise.allSettled([pay(), pay()]);
    expect(first).toEqual({
      status: 'fulfilled',
      value: { remainingCents: 7500 },
    });
    expect(second.status).toBe('rejected');
    expect((second as PromiseRejectedResult).reason).toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.financeEntry.create).toHaveBeenCalledTimes(1);
    expect(prisma.financeOwedPayment.create).toHaveBeenCalledTimes(1);
  });

  it('race on settle: second delete finds nothing, 409, no income', async () => {
    const { prisma, service } = setup();
    prisma.financeEntry.deleteMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      service.addOwedPayment('u1', 'd1', {
        amountCents: 10000,
        paidAt: '2026-10-05',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.financeEntry.create).not.toHaveBeenCalled();
    expect(prisma.financeOwedPayment.create).not.toHaveBeenCalled();
  });

  it('rejects at the entry cap inside the transaction, no income', async () => {
    const { prisma, service } = setup();
    prisma.financeEntry.count.mockResolvedValue(MAX_FINANCE_ENTRIES_PER_USER);
    await expect(
      service.addOwedPayment('u1', 'd1', {
        amountCents: 2500,
        paidAt: '2026-10-05',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.financeEntry.count).toHaveBeenCalledWith({
      where: { userId: 'u1' },
    });
    expect(prisma.financeEntry.create).not.toHaveBeenCalled();
  });

  it('stores the Idempotency-Key on the income entry', async () => {
    const { prisma, service } = setup();
    prisma.financeEntry.findFirst
      .mockResolvedValueOnce(null) // chave ainda nao usada
      .mockResolvedValueOnce(debt);
    await service.addOwedPayment(
      'u1',
      'd1',
      { amountCents: 2500, paidAt: '2026-10-05' },
      KEY,
    );
    expect(prisma.financeEntry.findFirst).toHaveBeenNthCalledWith(1, {
      where: {
        userId: 'u1',
        clientRequestId: KEY,
        kind: FinanceEntryKind.INCOME,
      },
      select: { createdAt: true },
    });
    expect(prisma.financeEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ clientRequestId: KEY }) as unknown,
      }),
    );
  });

  it('replayed Idempotency-Key does not pay again, returns current principal', async () => {
    const { prisma, service } = setup();
    prisma.financeEntry.findFirst
      .mockResolvedValueOnce({ createdAt: new Date() }) // ja paga
      .mockResolvedValueOnce({ amountCents: 7500 });
    const res = await service.addOwedPayment(
      'u1',
      'd1',
      { amountCents: 2500, paidAt: '2026-10-05' },
      KEY,
    );
    expect(res).toEqual({ remainingCents: 7500 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.financeEntry.create).not.toHaveBeenCalled();
  });

  it('rejects a non uuid Idempotency-Key', async () => {
    const { service } = setup();
    await expect(
      service.addOwedPayment(
        'u1',
        'd1',
        { amountCents: 2500, paidAt: '2026-10-05' },
        'nope',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('CreateOwedPaymentDto', () => {
  const check = (o: object) =>
    validate(plainToInstance(CreateOwedPaymentDto, o));

  it('accepts a valid payload', async () => {
    expect(await check({ amountCents: 500, paidAt: '2026-10-05' })).toEqual([]);
  });

  it.each([
    ['zero amount', { amountCents: 0, paidAt: '2026-10-05' }, 'amountCents'],
    [
      'fractional amount',
      { amountCents: 1.5, paidAt: '2026-10-05' },
      'amountCents',
    ],
    ['bad date', { amountCents: 500, paidAt: '05/10/2026' }, 'paidAt'],
  ])('rejects %s', async (_n, payload, prop) => {
    const errors = await check(payload);
    expect(errors.map((e) => e.property)).toContain(prop);
  });
});
