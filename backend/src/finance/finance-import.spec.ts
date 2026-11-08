import { BadRequestException } from '@nestjs/common';
import { FinanceEntryKind, FinanceFrequency } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FinanceService } from './finance.service';
import type { FinancePricesService } from './finance-prices.service';
import {
  ImportFinanceEntriesDto,
  type ImportFinanceEntryRowDto,
} from './dto/finance.dto';
import {
  FINANCE_NOTE_MAX_LENGTH,
  MAX_FINANCE_ACCOUNTS_PER_USER,
  MAX_FINANCE_ENTRIES_PER_USER,
  MAX_FINANCE_IMPORT_ROWS,
} from './finance.constants';
import type { PrismaService } from '../prisma/prisma.service';

const KEY = '11111111-1111-4111-8111-111111111111';
const CREATED_AT = new Date('2026-10-05T10:00:00Z');
const DAY = new Date('2026-10-01T00:00:00Z');

const row = (
  over: Partial<ImportFinanceEntryRowDto> = {},
): ImportFinanceEntryRowDto => ({
  kind: FinanceEntryKind.EXPENSE,
  amountCents: 1250,
  category: 'FOOD',
  note: 'Lunch',
  date: '2026-10-01',
  ...over,
});

interface Existing {
  date: Date;
  kind: FinanceEntryKind;
  category: string;
  amountCents: number;
  note: string | null;
}

function setup(
  opts: {
    count?: number;
    existing?: Existing[];
    accounts?: { id: string; name: string }[];
  } = {},
) {
  const tx = {
    financeEntry: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue(opts.existing ?? []),
      count: jest.fn().mockResolvedValue(opts.count ?? 0),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    financeAccount: {
      findMany: jest.fn().mockResolvedValue(opts.accounts ?? []),
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
  const created = (): Record<string, unknown>[] => {
    const calls = tx.financeEntry.createMany.mock.calls as [
      { data: Record<string, unknown>[] },
    ][];
    return calls[0]?.[0].data ?? [];
  };
  return { prisma, service, created };
}

describe('FinanceService.importEntries', () => {
  it('scopes every read and write to the user', async () => {
    const { prisma, service, created } = setup();
    await service.importEntries('u1', { rows: [row()] });
    expect(prisma.financeEntry.count).toHaveBeenCalledWith({
      where: { userId: 'u1' },
    });
    expect(prisma.financeAccount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u1' },
        take: MAX_FINANCE_ACCOUNTS_PER_USER,
      }),
    );
    expect(prisma.financeEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u1', date: { in: [DAY] } },
      }),
    );
    expect(created()).toEqual([
      expect.objectContaining({
        userId: 'u1',
        kind: FinanceEntryKind.EXPENSE,
        amountCents: 1250,
        category: 'FOOD',
        note: 'Lunch',
        date: DAY,
        frequency: null,
        recurring: false,
        accountId: null,
        clientRequestId: null,
      }),
    ]);
  });

  it('skips exact duplicates of existing entries, as a multiset', async () => {
    const { service, created } = setup({
      existing: [
        {
          date: DAY,
          kind: FinanceEntryKind.EXPENSE,
          category: 'FOOD',
          amountCents: 1250,
          note: 'Lunch',
        },
      ],
    });
    const res = await service.importEntries('u1', {
      rows: [row(), row(), row({ note: 'Dinner' })],
    });
    expect(res).toEqual({ imported: 2, skipped: 1 });
    expect(created().map((d) => d.note)).toEqual(['Lunch', 'Dinner']);
  });

  it('treats an empty note and no note as the same duplicate', async () => {
    const { service, prisma } = setup({
      existing: [
        {
          date: DAY,
          kind: FinanceEntryKind.EXPENSE,
          category: 'FOOD',
          amountCents: 1250,
          note: null,
        },
      ],
    });
    const res = await service.importEntries('u1', {
      rows: [row({ note: '' })],
    });
    expect(res).toEqual({ imported: 0, skipped: 1 });
    expect(prisma.financeEntry.createMany).not.toHaveBeenCalled();
  });

  it('does not count a different amount, kind or day as a duplicate', async () => {
    const { service } = setup({
      existing: [
        {
          date: DAY,
          kind: FinanceEntryKind.EXPENSE,
          category: 'FOOD',
          amountCents: 1250,
          note: 'Lunch',
        },
      ],
    });
    const res = await service.importEntries('u1', {
      rows: [
        row({ amountCents: 1251 }),
        row({ kind: FinanceEntryKind.INCOME }),
        row({ date: '2026-10-02' }),
      ],
    });
    expect(res).toEqual({ imported: 3, skipped: 0 });
  });

  it('stops at the entry cap inside the transaction', async () => {
    const { prisma, service, created } = setup({
      count: MAX_FINANCE_ENTRIES_PER_USER - 1,
    });
    const res = await service.importEntries('u1', {
      rows: [row(), row({ note: 'b' }), row({ note: 'c' })],
    });
    expect(res).toEqual({ imported: 1, skipped: 2 });
    expect(created()).toHaveLength(1);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('imports nothing when the user is already at the cap', async () => {
    const { prisma, service } = setup({ count: MAX_FINANCE_ENTRIES_PER_USER });
    const res = await service.importEntries('u1', { rows: [row()] });
    expect(res).toEqual({ imported: 0, skipped: 1 });
    expect(prisma.financeEntry.createMany).not.toHaveBeenCalled();
  });

  it('matches accounts by name, case-insensitively, only among own accounts', async () => {
    const { service, created } = setup({
      accounts: [
        { id: 'a-old', name: 'Revolut' },
        { id: 'a-new', name: 'revolut' },
      ],
    });
    await service.importEntries('u1', {
      rows: [
        row({ accountName: '  REVOLUT ' }),
        row({ note: 'x', accountName: 'Someone else bank' }),
        row({ note: 'y', accountName: null }),
      ],
    });
    expect(created().map((d) => d.accountId)).toEqual(['a-old', null, null]);
  });

  it('keeps the repeat frequency as a rule', async () => {
    const { service, created } = setup();
    await service.importEntries('u1', {
      rows: [row({ frequency: FinanceFrequency.MONTHLY })],
    });
    expect(created()[0]).toEqual(
      expect.objectContaining({
        frequency: FinanceFrequency.MONTHLY,
        recurring: true,
      }),
    );
  });

  it('rejects an impossible date before writing anything', async () => {
    const { prisma, service } = setup();
    await expect(
      service.importEntries('u1', {
        rows: [row(), row({ date: '2026-02-31' })],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('stores the Idempotency-Key on the first created row only', async () => {
    const { service, created } = setup();
    await service.importEntries(
      'u1',
      { rows: [row(), row({ note: 'b' })] },
      KEY,
    );
    expect(created().map((d) => d.clientRequestId)).toEqual([KEY, null]);
  });

  it('replayed key does not import again and reports the first batch', async () => {
    const { prisma, service } = setup();
    prisma.financeEntry.findFirst.mockResolvedValueOnce({
      createdAt: new Date(),
    });
    prisma.financeEntry.count.mockResolvedValueOnce(2);
    const res = await service.importEntries(
      'u1',
      { rows: [row(), row({ note: 'b' }), row({ note: 'c' })] },
      KEY,
    );
    expect(res).toEqual({ imported: 2, skipped: 1 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.financeEntry.findFirst).toHaveBeenCalledWith({
      where: { userId: 'u1', clientRequestId: KEY },
      select: { createdAt: true },
    });
  });

  it('rejects a non uuid Idempotency-Key', async () => {
    const { service } = setup();
    await expect(
      service.importEntries('u1', { rows: [row()] }, 'nope'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('a concurrent duplicate key reads the winner instead of failing', async () => {
    const { prisma, service } = setup();
    prisma.financeEntry.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ createdAt: CREATED_AT });
    prisma.$transaction.mockRejectedValueOnce({ code: 'P2002' });
    jest.useFakeTimers({ now: CREATED_AT, doNotFake: ['nextTick'] });
    try {
      prisma.financeEntry.count.mockResolvedValueOnce(1);
      const res = await service.importEntries('u1', { rows: [row()] }, KEY);
      expect(res).toEqual({ imported: 1, skipped: 0 });
      expect(prisma.financeEntry.count).toHaveBeenLastCalledWith({
        where: { userId: 'u1', createdAt: CREATED_AT },
      });
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('ImportFinanceEntriesDto', () => {
  const check = (o: object) =>
    validate(plainToInstance(ImportFinanceEntriesDto, o));
  const props = async (o: object) => {
    const errors = await check(o);
    return JSON.stringify(
      errors.map((e) => ({
        p: e.property,
        c: e.children?.map((c) => c.children?.map((cc) => cc.property)),
      })),
    );
  };

  it('accepts a valid batch', async () => {
    expect(
      await check({
        rows: [
          row({ accountName: 'Bank', frequency: FinanceFrequency.WEEKLY }),
        ],
      }),
    ).toEqual([]);
  });

  it('rejects an empty batch and one over the row limit', async () => {
    expect(await props({ rows: [] })).toContain('rows');
    expect(
      await props({
        rows: Array.from({ length: MAX_FINANCE_IMPORT_ROWS + 1 }, () => row()),
      }),
    ).toContain('rows');
  });

  it.each([
    ['fractional amount', { amountCents: 1.5 }, 'amountCents'],
    ['zero amount', { amountCents: 0 }, 'amountCents'],
    ['unknown category', { category: 'PIZZA' }, 'category'],
    ['owed payment kind', { kind: 'OWED_PAYMENT' }, 'kind'],
    ['bad date', { date: '01/10/2026' }, 'date'],
    ['long note', { note: 'x'.repeat(FINANCE_NOTE_MAX_LENGTH + 1) }, 'note'],
    ['bad frequency', { frequency: 'DAILY' }, 'frequency'],
  ])('rejects a row with %s', async (_n, over, prop) => {
    expect(await props({ rows: [row(over as object)] })).toContain(`"${prop}"`);
  });

  it('rejects unknown row fields like isOwed', async () => {
    const errors = await validate(
      plainToInstance(ImportFinanceEntriesDto, {
        rows: [{ ...row(), isOwed: true }],
      }),
      { whitelist: true, forbidNonWhitelisted: true },
    );
    expect(errors).not.toEqual([]);
  });
});
