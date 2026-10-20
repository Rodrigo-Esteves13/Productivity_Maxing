import { bulkRescheduleTasks } from './bulk-reschedule.util';

interface UpdateManyArgs {
  where: Record<string, unknown>;
  data: Record<string, unknown>;
}

function makePrisma() {
  const updateMany = jest
    .fn<Promise<{ count: number }>, [UpdateManyArgs]>()
    .mockResolvedValueOnce({ count: 2 })
    .mockResolvedValueOnce({ count: 1 });
  const prisma = {
    task: { updateMany },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  return { prisma, updateMany };
}

describe('bulkRescheduleTasks', () => {
  const date = new Date('2026-10-21T00:00:00.000Z');

  it('so incrementa postponedCount nas tasks cuja data avanca', async () => {
    const { prisma, updateMany } = makePrisma();
    const result = await bulkRescheduleTasks(
      prisma as never,
      'user-1',
      ['a', 'b', 'c'],
      date,
    );

    expect(result).toEqual({ count: 3 });
    expect(updateMany).toHaveBeenCalledTimes(2);
    const [later, earlier] = updateMany.mock.calls.map(([args]) => args);
    expect(later.where.date).toEqual({ lt: date });
    expect(later.data).toEqual({ date, postponedCount: { increment: 1 } });
    expect(earlier.where.date).toEqual({ gte: date });
    expect(earlier.data).toEqual({ date });
  });

  it('limita sempre ao dono e deixa as concluidas de fora', async () => {
    const { prisma, updateMany } = makePrisma();
    await bulkRescheduleTasks(prisma as never, 'user-1', ['a'], date);

    for (const [args] of updateMany.mock.calls) {
      expect(args.where.userId).toBe('user-1');
      expect(args.where.id).toEqual({ in: ['a'] });
      expect(args.where.progressStatus).toEqual({ not: 'COMPLETED' });
    }
  });
});
