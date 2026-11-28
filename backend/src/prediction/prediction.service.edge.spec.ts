// Casos extra do PredictionService: ownership, erros e limites que o
// prediction.service.spec.ts nao cobre. Prisma em mock.
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PredictionService } from './prediction.service';
import type { PrismaService } from '../prisma/prisma.service';

const SECONDS_PER_MINUTE = 60;

interface MockPrisma {
  task: { findMany: jest.Mock; findFirst: jest.Mock };
  taskType: { findUnique: jest.Mock };
  studySession: { findMany: jest.Mock };
  $queryRaw: jest.Mock;
}

function setup(
  opts: {
    tasks?: unknown[];
    rows?: unknown[];
    ownedTask?: unknown;
    taskType?: unknown;
    sessions?: unknown[];
  } = {},
) {
  const prisma: MockPrisma = {
    task: {
      findMany: jest.fn().mockResolvedValue(opts.tasks ?? []),
      findFirst: jest.fn().mockResolvedValue(opts.ownedTask ?? null),
    },
    taskType: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          opts.taskType === undefined
            ? { id: 'type1', isActive: true }
            : opts.taskType,
        ),
    },
    studySession: {
      findMany: jest.fn().mockResolvedValue(opts.sessions ?? []),
    },
    $queryRaw: jest.fn().mockResolvedValue(opts.rows ?? []),
  };
  const service = new PredictionService(prisma as unknown as PrismaService);
  return { service, prisma };
}

const dto = { type: 'EXAM', difficulty: 'MEDIUM' as const };

describe('PredictionService.predictDuration (edge cases)', () => {
  it('unknown or foreign taskId: NotFound, scoped by userId, no training', async () => {
    const { service, prisma } = setup({ ownedTask: null });
    await expect(
      service.predictDuration('u1', { ...dto, taskId: 'other-users-task' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.task.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'other-users-task', userId: 'u1' },
      }),
    );
    expect(prisma.taskType.findUnique).not.toHaveBeenCalled();
    expect(prisma.task.findMany).not.toHaveBeenCalled();
  });

  it('inactive task type: BadRequest', async () => {
    const { service } = setup({ taskType: { id: 't', isActive: false } });
    await expect(service.predictDuration('u1', dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('missing task type: BadRequest', async () => {
    const { service } = setup({ taskType: null });
    await expect(service.predictDuration('u1', dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('without taskId: no task lookup, actualMinutes null, insufficient data', async () => {
    const { service, prisma } = setup();
    const result = await service.predictDuration('u1', dto);
    expect(prisma.task.findFirst).not.toHaveBeenCalled();
    expect(prisma.studySession.findMany).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      predictedMinutes: null,
      rangeMinutes: null,
      method: 'insufficient_data',
      sampleSize: 0,
      actualMinutes: null,
    });
  });

  it('owned task: actual minutes read from finished sessions of that user', async () => {
    const start = new Date('2026-01-01T10:00:00Z');
    const { service, prisma } = setup({
      ownedTask: { estimatedMinutes: 30, areaId: 'a1' },
      sessions: [
        { startedAt: start, endedAt: new Date(start.getTime() + 45 * 60_000) },
      ],
    });
    const result = await service.predictDuration('u1', {
      ...dto,
      taskId: 't1',
    });
    expect(result.actualMinutes).toBe(45);
    expect(prisma.studySession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u1', taskId: 't1', endedAt: { not: null } },
      }),
    );
  });

  it('owned task without sessions: actualMinutes null', async () => {
    const { service } = setup({
      ownedTask: { estimatedMinutes: null, areaId: 'a1' },
    });
    const result = await service.predictDuration('u1', {
      ...dto,
      taskId: 't1',
    });
    expect(result.actualMinutes).toBeNull();
  });

  it('training query is scoped to the caller', async () => {
    const { service, prisma } = setup();
    await service.predictDuration('u9', dto);
    const [arg] = prisma.task.findMany.mock.calls[0] as [
      { where: { userId: string } },
    ];
    expect(arg.where.userId).toBe('u9');
  });
});

describe('PredictionService.predictForTasks (edge cases)', () => {
  it('empty list: no queries at all', async () => {
    const { service, prisma } = setup();
    const result = await service.predictForTasks('u1', []);
    expect(result.method).toBe('insufficient_data');
    expect(result.minutesByTaskId.size).toBe(0);
    expect(prisma.task.findMany).not.toHaveBeenCalled();
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});

describe('PredictionService.getCalibrationFactor (edge cases)', () => {
  const mk = (n: number, estimated: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: `t${i}`,
      estimatedMinutes: estimated,
      recalledStudyMinutes: null,
    }));
  const rowsFor = (tasks: { id: string }[], minutes: number) =>
    tasks.map((t) => ({
      taskId: t.id,
      focusRating: null,
      seconds: minutes * SECONDS_PER_MINUTE,
    }));

  it('no tasks: null and no SQL', async () => {
    const { service, prisma } = setup();
    await expect(service.getCalibrationFactor('u1')).resolves.toBeNull();
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('clamps a huge ratio to 2.5', async () => {
    const tasks = mk(3, 10);
    const { service } = setup({ tasks, rows: rowsFor(tasks, 1000) });
    await expect(service.getCalibrationFactor('u1')).resolves.toBe(2.5);
  });

  it('clamps a tiny ratio to 0.5', async () => {
    const tasks = mk(3, 1000);
    const { service } = setup({ tasks, rows: rowsFor(tasks, 10) });
    await expect(service.getCalibrationFactor('u1')).resolves.toBe(0.5);
  });

  it('tasks without known time do not count as samples', async () => {
    const tasks = mk(3, 60);
    // So 2 com sessoes: abaixo do minimo de 3.
    const { service } = setup({ tasks, rows: rowsFor(tasks.slice(0, 2), 60) });
    await expect(service.getCalibrationFactor('u1')).resolves.toBeNull();
  });

  it('session SQL is scoped to the user', async () => {
    const tasks = mk(3, 60);
    const { service, prisma } = setup({ tasks, rows: rowsFor(tasks, 60) });
    await service.getCalibrationFactor('u7');
    const [query] = prisma.$queryRaw.mock.calls[0] as [{ values: unknown[] }];
    expect(query.values[0]).toBe('u7');
  });
});

describe('PredictionService.getEstimationAccuracy (edge cases)', () => {
  it('tasks with an estimate but zero known time are skipped', async () => {
    const { service } = setup({
      tasks: [{ id: 't1', estimatedMinutes: 60, recalledStudyMinutes: null }],
      rows: [{ taskId: 't1', focusRating: null, seconds: 0 }],
    });
    const result = await service.getEstimationAccuracy('u1');
    expect(result.sampleSize).toBe(0);
    expect(result.avgEstimatedMinutes).toBeNull();
    expect(result.avgActualMinutes).toBeNull();
  });

  it('exactly 20 percent error counts as accurate', async () => {
    const { service } = setup({
      tasks: [{ id: 't1', estimatedMinutes: 100, recalledStudyMinutes: 120 }],
    });
    const result = await service.getEstimationAccuracy('u1');
    expect(result.accurateCount).toBe(1);
    expect(result.underestimatedCount).toBe(0);
  });

  it('just over 20 percent splits into over and under', async () => {
    const { service } = setup({
      tasks: [
        { id: 't1', estimatedMinutes: 100, recalledStudyMinutes: 121 },
        { id: 't2', estimatedMinutes: 100, recalledStudyMinutes: 79 },
      ],
    });
    const result = await service.getEstimationAccuracy('u1');
    expect(result.underestimatedCount).toBe(1);
    expect(result.overestimatedCount).toBe(1);
    expect(result.accurateCount).toBe(0);
  });

  it('query is scoped to the user', async () => {
    const { service, prisma } = setup();
    await service.getEstimationAccuracy('u5');
    const [arg] = prisma.task.findMany.mock.calls[0] as [
      { where: { userId: string } },
    ];
    expect(arg.where.userId).toBe('u5');
  });
});
