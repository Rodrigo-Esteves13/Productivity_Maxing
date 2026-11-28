// Casos de borda que faltam em grade-component.util.spec.ts e
// grade-components.service.spec.ts: BEST_OF/DROP_LOWEST, pesos e limites.
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  componentsToGradedItems,
  computeComponentGrade,
} from './grade-component.util';
import { GradeComponentsService } from './grade-components.service';
import { MAX_ENTRIES_PER_COMPONENT } from './grade-components.constants';
import type { GradeAggregationKind } from './grade-components.constants';
import type { PrismaService } from '../prisma/prisma.service';

describe('computeComponentGrade edge cases', () => {
  it('returns null when every value is non finite', () => {
    expect(
      computeComponentGrade([Number.NaN, Infinity, -Infinity], 'AVERAGE'),
    ).toBeNull();
  });

  it('BEST_OF does not depend on input order', () => {
    expect(computeComponentGrade([18, 8, 16, 12], 'BEST_OF', 2)).toBe(17);
  });

  it('BEST_OF with N = 1 keeps only the top grade', () => {
    expect(computeComponentGrade([3, 19, 7], 'BEST_OF', 1)).toBe(19);
  });

  it('BEST_OF with 0 or negative N falls back to all entries', () => {
    expect(computeComponentGrade([10, 20], 'BEST_OF', 0)).toBe(15);
    expect(computeComponentGrade([10, 20], 'BEST_OF', -3)).toBe(15);
  });

  it('BEST_OF ignores NaN before picking the best N', () => {
    expect(computeComponentGrade([Number.NaN, 10, 20, 4], 'BEST_OF', 2)).toBe(
      15,
    );
  });

  it('rounds to 2 decimals', () => {
    expect(computeComponentGrade([10, 10, 11], 'AVERAGE')).toBe(10.33);
    expect(computeComponentGrade([10, 10, 11], 'BEST_OF', 2)).toBe(10.5);
  });

  it('DROP_LOWEST with two entries keeps only the best', () => {
    expect(computeComponentGrade([6, 14], 'DROP_LOWEST')).toBe(14);
  });

  it('DROP_LOWEST with ties drops exactly one', () => {
    expect(computeComponentGrade([5, 5, 11], 'DROP_LOWEST')).toBe(8);
  });

  it('DROP_LOWEST ignores NaN when deciding the lowest', () => {
    expect(computeComponentGrade([Number.NaN, 4, 14, 16], 'DROP_LOWEST')).toBe(
      15,
    );
  });

  it('an unknown aggregation behaves like AVERAGE', () => {
    expect(
      computeComponentGrade([10, 20], 'WHATEVER' as GradeAggregationKind),
    ).toBe(15);
  });

  it('keeps a legitimate 0 grade (not treated as missing)', () => {
    expect(computeComponentGrade([0], 'AVERAGE')).toBe(0);
    expect(computeComponentGrade([0, 10], 'BEST_OF', 1)).toBe(10);
  });
});

describe('componentsToGradedItems edge cases', () => {
  const comp = (over: Record<string, unknown>) => ({
    areaId: 'a1',
    periodId: 'p1',
    weightPercentage: 10,
    aggregation: 'AVERAGE' as GradeAggregationKind,
    bestOfCount: null,
    entries: [{ grade: 10 }],
    ...over,
  });

  it('returns an empty list for no components', () => {
    expect(componentsToGradedItems([])).toEqual([]);
  });

  it('applies BEST_OF per component and keeps weights and ids', () => {
    const items = componentsToGradedItems([
      comp({
        aggregation: 'BEST_OF',
        bestOfCount: 2,
        weightPercentage: 30,
        entries: [{ grade: 8 }, { grade: 12 }, { grade: 16 }, { grade: 18 }],
      }),
      comp({
        areaId: 'a2',
        periodId: 'p2',
        weightPercentage: 25,
        aggregation: 'DROP_LOWEST',
        entries: [{ grade: 4 }, { grade: 14 }, { grade: 16 }],
      }),
    ]);
    expect(items).toEqual([
      { areaId: 'a1', periodId: 'p1', realGrade: 17, weightPercentage: 30 },
      { areaId: 'a2', periodId: 'p2', realGrade: 15, weightPercentage: 25 },
    ]);
  });

  it('skips a component whose entries are all non finite', () => {
    expect(
      componentsToGradedItems([comp({ entries: [{ grade: Number.NaN }] })]),
    ).toEqual([]);
  });

  it('keeps a component graded 0 (zero is a real grade)', () => {
    const items = componentsToGradedItems([comp({ entries: [{ grade: 0 }] })]);
    expect(items).toHaveLength(1);
    expect(items[0].realGrade).toBe(0);
  });
});

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
  const prisma = {
    task: {
      findMany: jest.fn().mockResolvedValue([]),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    gradeComponent: {
      findFirst: jest.fn().mockResolvedValue(componentRow()),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      aggregate: jest.fn().mockResolvedValue({ _sum: { weightPercentage: 0 } }),
      groupBy: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue(componentRow()),
      update: jest.fn().mockResolvedValue(componentRow()),
      delete: jest.fn().mockResolvedValue({}),
    },
    gradeEntry: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({}),
    },
    academicPeriod: { findFirst: jest.fn().mockResolvedValue({ id: 'p1' }) },
    area: { findFirst: jest.fn().mockResolvedValue({ id: 'a1' }) },
    $executeRaw: jest.fn().mockResolvedValue(1),
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(
    (work: (tx: unknown) => Promise<unknown>) => work(prisma),
  );
  const service = new GradeComponentsService(
    prisma as unknown as PrismaService,
  );
  return { prisma, service };
}

const dto = {
  areaId: 'a1',
  periodId: 'p1',
  name: 'Seminars',
  weightPercentage: 20,
};

describe('GradeComponentsService.create edge cases', () => {
  it('rejects BEST_OF without a count and never opens a transaction', async () => {
    const { prisma, service } = setup();
    await expect(
      service.create('u1', { ...dto, aggregation: 'BEST_OF' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects BEST_OF with count 0', async () => {
    const { service } = setup();
    await expect(
      service.create('u1', { ...dto, aggregation: 'BEST_OF', bestOfCount: 0 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('stores bestOfCount for BEST_OF and null for other aggregations', async () => {
    const { prisma, service } = setup();
    await service.create('u1', {
      ...dto,
      aggregation: 'BEST_OF',
      bestOfCount: 3,
    });
    expect(prisma.gradeComponent.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          aggregation: 'BEST_OF',
          bestOfCount: 3,
        }) as unknown,
      }),
    );

    await service.create('u1', {
      ...dto,
      aggregation: 'AVERAGE',
      bestOfCount: 3,
    });
    expect(prisma.gradeComponent.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          aggregation: 'AVERAGE',
          bestOfCount: null,
        }) as unknown,
      }),
    );
  });

  it('defaults to AVERAGE when no aggregation is given', async () => {
    const { prisma, service } = setup();
    await service.create('u1', dto);
    expect(prisma.gradeComponent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          aggregation: 'AVERAGE',
          bestOfCount: null,
        }) as unknown,
      }),
    );
  });

  it('404 when the period is not the user own', async () => {
    const { prisma, service } = setup();
    prisma.academicPeriod.findFirst.mockResolvedValueOnce(null);
    await expect(service.create('u1', dto)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.gradeComponent.create).not.toHaveBeenCalled();
  });

  it('404 when the area is not accessible', async () => {
    const { prisma, service } = setup();
    prisma.area.findFirst.mockResolvedValueOnce(null);
    await expect(service.create('u1', dto)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects the 13th component of a course and period', async () => {
    const { prisma, service } = setup();
    prisma.gradeComponent.count.mockResolvedValueOnce(12);
    await expect(service.create('u1', dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.gradeComponent.create).not.toHaveBeenCalled();
  });

  it('maps a unique violation to 409', async () => {
    const { prisma, service } = setup();
    prisma.gradeComponent.create.mockRejectedValueOnce({ code: 'P2002' });
    await expect(service.create('u1', dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rethrows other database errors untouched', async () => {
    const { prisma, service } = setup();
    const boom = new Error('db down');
    prisma.gradeComponent.create.mockRejectedValueOnce(boom);
    await expect(service.create('u1', dto)).rejects.toBe(boom);
  });

  it('accepts weights that fill 100% exactly, tolerating float noise', async () => {
    const { prisma, service } = setup();
    // 33.3 + 33.3 = 66.6 usados, sobram 33.4.
    prisma.gradeComponent.aggregate.mockResolvedValue({
      _sum: { weightPercentage: 66.6 },
    });
    await expect(
      service.create('u1', { ...dto, weightPercentage: 33.4 }),
    ).resolves.toBeDefined();
  });

  it('counts a recurring task series once and a one-off in full', async () => {
    const { prisma, service } = setup();
    prisma.task.findMany.mockResolvedValue([
      { title: 'Quiz', weightPercentage: 10, recurrenceFrequency: 'WEEKLY' },
      { title: 'Quiz', weightPercentage: 10, recurrenceFrequency: 'WEEKLY' },
      { title: 'Exam', weightPercentage: 50, recurrenceFrequency: null },
    ]);
    // usado = 10 + 50 = 60, sobram 40
    await expect(
      service.create('u1', { ...dto, weightPercentage: 40 }),
    ).resolves.toBeDefined();
    await expect(
      service.create('u1', { ...dto, weightPercentage: 40.5 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('GradeComponentsService.update edge cases', () => {
  it('rejects switching to BEST_OF with no count', async () => {
    const { prisma, service } = setup();
    await expect(
      service.update('u1', 'c1', { aggregation: 'BEST_OF' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.gradeComponent.update).not.toHaveBeenCalled();
  });

  it('keeps the stored bestOfCount when only the name changes', async () => {
    const { prisma, service } = setup();
    prisma.gradeComponent.findFirst.mockResolvedValue(
      componentRow({ aggregation: 'BEST_OF', bestOfCount: 2 }),
    );
    await service.update('u1', 'c1', { name: 'Labs' });
    expect(prisma.gradeComponent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          aggregation: 'BEST_OF',
          bestOfCount: 2,
        }) as unknown,
      }),
    );
  });

  it('clears bestOfCount when switching away from BEST_OF', async () => {
    const { prisma, service } = setup();
    prisma.gradeComponent.findFirst.mockResolvedValue(
      componentRow({ aggregation: 'BEST_OF', bestOfCount: 2 }),
    );
    await service.update('u1', 'c1', { aggregation: 'AVERAGE' });
    expect(prisma.gradeComponent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          aggregation: 'AVERAGE',
          bestOfCount: null,
        }) as unknown,
      }),
    );
  });

  it('accepts a new count together with BEST_OF', async () => {
    const { prisma, service } = setup();
    await service.update('u1', 'c1', {
      aggregation: 'BEST_OF',
      bestOfCount: 4,
    });
    expect(prisma.gradeComponent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ bestOfCount: 4 }) as unknown,
      }),
    );
  });

  it('does not check the budget when the weight goes down or stays', async () => {
    const { prisma, service } = setup();
    prisma.gradeComponent.aggregate.mockResolvedValue({
      _sum: { weightPercentage: 100 },
    });
    await expect(
      service.update('u1', 'c1', { weightPercentage: 10 }),
    ).resolves.toBeDefined();
    await expect(
      service.update('u1', 'c1', { weightPercentage: 20 }),
    ).resolves.toBeDefined();
  });

  it('rejects a weight increase that busts 100%, excluding itself from the sum', async () => {
    const { prisma, service } = setup();
    // outros componentes: 90 (o proprio ja foi excluido pelo filtro)
    prisma.gradeComponent.aggregate.mockResolvedValue({
      _sum: { weightPercentage: 90 },
    });
    await expect(
      service.update('u1', 'c1', { weightPercentage: 25 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    const [args] = prisma.gradeComponent.aggregate.mock.calls[0] as [
      { where: { id?: { not: string } } },
    ];
    expect(args.where.id).toEqual({ not: 'c1' });
    expect(prisma.gradeComponent.update).not.toHaveBeenCalled();
  });

  it('404 for a component of another user, no write', async () => {
    const { prisma, service } = setup();
    prisma.gradeComponent.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.update('u1', 'nope', { name: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('maps a unique violation on rename to 409', async () => {
    const { prisma, service } = setup();
    prisma.gradeComponent.update.mockRejectedValueOnce({ code: 'P2002' });
    await expect(
      service.update('u1', 'c1', { name: 'Dup' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('GradeComponentsService remove / entries edge cases', () => {
  it('remove 404s for a foreign component and never deletes', async () => {
    const { prisma, service } = setup();
    prisma.gradeComponent.findFirst.mockResolvedValueOnce(null);
    await expect(service.remove('u1', 'x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.gradeComponent.delete).not.toHaveBeenCalled();
  });

  it('remove deletes scoped by owner', async () => {
    const { prisma, service } = setup();
    await service.remove('u1', 'c1');
    expect(prisma.gradeComponent.delete).toHaveBeenCalledWith({
      where: { id: 'c1', userId: 'u1' },
    });
  });

  it('addEntry rejects past the per component limit', async () => {
    const { prisma, service } = setup();
    prisma.gradeEntry.count.mockResolvedValueOnce(MAX_ENTRIES_PER_COMPONENT);
    await expect(
      service.addEntry('u1', 'c1', { grade: 10 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.gradeEntry.create).not.toHaveBeenCalled();
  });

  it('addEntry normalises empty label and missing date to null', async () => {
    const { prisma, service } = setup();
    await service.addEntry('u1', 'c1', { grade: 10, label: '' });
    expect(prisma.gradeEntry.create).toHaveBeenCalledWith({
      data: { componentId: 'c1', grade: 10, label: null, date: null },
    });
  });

  it('addEntry 404s for a foreign component before counting', async () => {
    const { prisma, service } = setup();
    prisma.gradeComponent.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.addEntry('u1', 'x', { grade: 10 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.gradeEntry.count).not.toHaveBeenCalled();
  });

  it('returns the aggregated grade in the view (BEST_OF) and null with no entries', async () => {
    const { prisma, service } = setup();
    prisma.gradeComponent.findMany.mockResolvedValue([
      componentRow({
        id: 'c1',
        aggregation: 'BEST_OF',
        bestOfCount: 2,
        entries: [
          { id: 'e1', label: null, grade: 8, date: null },
          { id: 'e2', label: 'T1', grade: 16, date: new Date('2026-01-02') },
          { id: 'e3', label: null, grade: 18, date: null },
        ],
      }),
      componentRow({ id: 'c2' }),
    ]);
    const [a, b] = await service.list('u1', {});
    expect(a.grade).toBe(17);
    expect(a.entries[1].date).toBe('2026-01-02T00:00:00.000Z');
    expect(b.grade).toBeNull();
  });

  it('list scopes by user and the optional filters', async () => {
    const { prisma, service } = setup();
    await service.list('u1', { periodId: 'p1', areaId: 'a1' });
    expect(prisma.gradeComponent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u1', periodId: 'p1', areaId: 'a1' },
      }),
    );
  });
});
