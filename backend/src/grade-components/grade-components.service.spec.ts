// B-36 (weightBudgets com groupBy), B-44 (entradas validadas numa query),
// B-42 (create com o lock por user) e B-43. Prisma mockado: sem BD.
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GradeComponentsService } from './grade-components.service';
import { loadUsedWeightByArea } from './weight-budget';
import type { PrismaService } from '../prisma/prisma.service';

function componentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    areaId: 'a1',
    periodId: 'p1',
    name: 'Seminars',
    weightPercentage: 20,
    aggregation: 'AVERAGE',
    bestOfCount: null,
    expectedEntries: null,
    entries: [],
    ...overrides,
  };
}

function setup() {
  const log: string[] = [];
  const prisma = {
    task: {
      findMany: jest.fn(() => {
        log.push('task.findMany');
        return Promise.resolve([]);
      }),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    gradeComponent: {
      findFirst: jest.fn().mockResolvedValue(componentRow()),
      count: jest.fn(() => {
        log.push('gradeComponent.count');
        return Promise.resolve(0);
      }),
      aggregate: jest.fn().mockResolvedValue({ _sum: { weightPercentage: 0 } }),
      groupBy: jest.fn().mockResolvedValue([]),
      create: jest.fn(() => {
        log.push('gradeComponent.create');
        return Promise.resolve(componentRow());
      }),
      update: jest.fn().mockResolvedValue(componentRow()),
    },
    gradeEntry: {
      findFirst: jest.fn().mockResolvedValue({ id: 'e1' }),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
    },
    academicPeriod: { findFirst: jest.fn().mockResolvedValue({ id: 'p1' }) },
    area: { findFirst: jest.fn().mockResolvedValue({ id: 'a1' }) },
    $executeRaw: jest.fn(() => {
      log.push('lock');
      return Promise.resolve(1);
    }),
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(
    (work: (tx: unknown) => Promise<unknown>) => work(prisma),
  );
  const service = new GradeComponentsService(
    prisma as unknown as PrismaService,
  );
  return { prisma, service, log };
}

describe('GradeComponentsService.weightBudgets (B-36)', () => {
  it('builds every course budget from 3 groupBy queries, not one per course', async () => {
    const { prisma, service } = setup();
    prisma.task.groupBy
      // tasks normais por cadeira
      .mockResolvedValueOnce([
        { areaId: 'a1', _sum: { weightPercentage: 30 } },
        { areaId: 'a2', _sum: { weightPercentage: 50 } },
      ])
      // series recorrentes: o peso conta uma vez por titulo
      .mockResolvedValueOnce([
        { areaId: 'a1', title: 'Quiz', _max: { weightPercentage: 10 } },
      ]);
    prisma.gradeComponent.groupBy.mockResolvedValueOnce([
      { areaId: 'a1', _sum: { weightPercentage: 20 } },
      { areaId: 'a3', _sum: { weightPercentage: 100 } },
    ]);

    const result = await service.weightBudgets('u1', 'p1');

    expect(prisma.task.groupBy).toHaveBeenCalledTimes(2);
    expect(prisma.gradeComponent.groupBy).toHaveBeenCalledTimes(1);
    expect(prisma.task.findMany).not.toHaveBeenCalled();
    expect(result.max).toBe(100);
    expect(result.budgets).toEqual(
      expect.arrayContaining([
        { areaId: 'a1', used: 60, remaining: 40 },
        { areaId: 'a2', used: 50, remaining: 50 },
        { areaId: 'a3', used: 100, remaining: 0 },
      ]),
    );
    expect(result.budgets).toHaveLength(3);
    for (const call of prisma.task.groupBy.mock.calls as [
      { where: Record<string, unknown> },
    ][]) {
      expect(call[0].where).toMatchObject({ userId: 'u1', periodId: 'p1' });
    }
  });
});

describe('loadUsedWeightByArea', () => {
  it('filters by the given courses and skips the period filter of components when there is none', async () => {
    const { prisma } = setup();

    await loadUsedWeightByArea(prisma as unknown as PrismaService, {
      userId: 'u1',
      periodId: null,
      areaIds: ['a1'],
    });

    const [single, series] = prisma.task.groupBy.mock.calls as [
      { where: Record<string, unknown> },
    ][];
    expect(single[0].where).toMatchObject({
      userId: 'u1',
      periodId: null,
      areaId: { in: ['a1'] },
      recurrenceFrequency: null,
    });
    expect(series[0].where).toMatchObject({
      recurrenceFrequency: { not: null },
    });
    expect(
      (
        prisma.gradeComponent.groupBy.mock.calls[0] as [
          { where: Record<string, unknown> },
        ]
      )[0].where,
    ).toEqual({ userId: 'u1', areaId: { in: ['a1'] } });
  });
});

describe('GradeComponentsService entries (B-44)', () => {
  it('updateEntry validates entry + component + owner in one query and reloads once', async () => {
    const { prisma, service } = setup();

    await service.updateEntry('u1', 'c1', 'e1', { grade: 15 });

    const scope = { id: 'e1', componentId: 'c1', component: { userId: 'u1' } };
    expect(prisma.gradeEntry.findFirst).toHaveBeenCalledWith({
      where: scope,
      select: { id: true },
    });
    expect(prisma.gradeEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: scope }),
    );
    // So o recarregar do componente (antes eram duas leituras).
    expect(prisma.gradeComponent.findFirst).toHaveBeenCalledTimes(1);
  });

  it('removeEntry deletes scoped by owner and reloads once', async () => {
    const { prisma, service } = setup();

    await service.removeEntry('u1', 'c1', 'e1');

    expect(prisma.gradeEntry.delete).toHaveBeenCalledWith({
      where: { id: 'e1', componentId: 'c1', component: { userId: 'u1' } },
    });
    expect(prisma.gradeComponent.findFirst).toHaveBeenCalledTimes(1);
  });

  it('answers 404 for an entry of another user and never writes', async () => {
    const { prisma, service } = setup();
    prisma.gradeEntry.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.removeEntry('u1', 'c1', 'foreign'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.gradeEntry.delete).not.toHaveBeenCalled();
    expect(prisma.gradeComponent.findFirst).not.toHaveBeenCalled();
  });
});

describe('GradeComponentsService writes under the user lock (B-42, B-43)', () => {
  const dto = {
    areaId: 'a1',
    periodId: 'p1',
    name: 'Seminars',
    weightPercentage: 20,
  };

  it('create takes the lock before counting, checking the weight and inserting', async () => {
    const { service, log } = setup();

    await service.create('u1', dto);

    expect(log).toEqual([
      'lock',
      'gradeComponent.count',
      'task.findMany',
      'gradeComponent.create',
    ]);
  });

  it('create rejects a weight over 100% without inserting', async () => {
    const { prisma, service } = setup();
    prisma.gradeComponent.aggregate.mockResolvedValueOnce({
      _sum: { weightPercentage: 90 },
    });

    await expect(service.create('u1', dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.gradeComponent.create).not.toHaveBeenCalled();
  });

  it('update writes with userId in the where', async () => {
    const { prisma, service } = setup();

    await service.update('u1', 'c1', { name: 'Labs' });

    expect(prisma.gradeComponent.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'c1', userId: 'u1' } }),
    );
  });
});
