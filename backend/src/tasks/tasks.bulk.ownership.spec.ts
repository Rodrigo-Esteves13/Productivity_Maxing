// Ownership (userId) e casos limite dos bulk ops, reorder e
// applyCompletionSideEffects. Prisma mockado: sem base de dados.
import { BadRequestException } from '@nestjs/common';
import { TasksService } from './tasks.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { PeriodsService } from '../academic-programs/periods.service';
import type { TaskMetaCacheService } from '../common/task-meta-cache.service';
import type { TaskAttachmentsService } from './task-attachments.service';

jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn() }));
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({})),
}));

const TYPE = { id: 'tt', key: 'ACADEMICO', isActive: true };

function taskRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 't1',
    userId: 'u1',
    areaId: 'a1',
    periodId: 'p1',
    title: 'Quiz',
    date: new Date('2026-10-01T00:00:00.000Z'),
    dateCertainty: 'EXACT',
    progressStatus: 'ON_TRACK',
    completedAt: null,
    weightPercentage: null,
    difficulty: 'MEDIUM',
    isPinned: false,
    isBlocked: false,
    topics: null,
    referenceLink: null,
    estimatedMinutes: null,
    calendarDurationMinutes: null,
    recurrenceFrequency: null,
    recurrenceInterval: 1,
    recurrenceUntil: null,
    spacedReviewOfTaskId: null,
    taskTypeId: TYPE.id,
    taskType: TYPE,
    academicTypeId: null,
    academicType: null,
    priorityId: null,
    priority: null,
    area: { id: 'a1', name: 'Calc' },
    subtasks: [],
    ...overrides,
  };
}

function setup() {
  const prisma = {
    task: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ ...taskRow(), ...data, id: 'spawned' }),
      ),
      aggregate: jest.fn().mockResolvedValue({ _max: { sortOrder: 5 } }),
      count: jest.fn().mockResolvedValue(0),
    },
    taskChange: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
    taskType: { findUnique: jest.fn().mockResolvedValue(TYPE) },
    academicTaskType: { findUnique: jest.fn().mockResolvedValue(null) },
    priority: { findUnique: jest.fn().mockResolvedValue(null) },
    user: {
      findUnique: jest.fn().mockResolvedValue({ spacedReviewsEnabled: false }),
    },
    gradeComponent: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { weightPercentage: 0 } }),
    },
    $executeRaw: jest.fn().mockResolvedValue(1),
    $transaction: jest.fn((arg: unknown): Promise<unknown> => {
      if (typeof arg === 'function') {
        return (arg as (tx: unknown) => Promise<unknown>)(prisma);
      }
      return Promise.all(arg as unknown[]);
    }),
  };
  const removeFilesForTasks = jest.fn().mockResolvedValue(undefined);
  const service = new TasksService(
    prisma as unknown as PrismaService,
    {} as PeriodsService,
    {} as TaskMetaCacheService,
    { removeFilesForTasks } as unknown as TaskAttachmentsService,
  );
  return { prisma, service, removeFilesForTasks };
}

type WhereArg = { where: Record<string, unknown> };
const whereOf = (mock: jest.Mock, call = 0) =>
  (mock.mock.calls[call] as [WhereArg])[0].where;

describe('TasksService.bulkUpdateStatus ownership', () => {
  it('COMPLETED: foreign-only ids touch nothing (read and write scoped)', async () => {
    const { prisma, service } = setup();
    const result = await service.bulkUpdateStatus(
      'u1',
      ['foreign-1', 'foreign-2'],
      'COMPLETED',
    );
    expect(result).toEqual({ count: 0 });
    expect(whereOf(prisma.task.findMany)).toMatchObject({
      userId: 'u1',
      id: { in: ['foreign-1', 'foreign-2'] },
    });
    expect(prisma.task.updateMany).not.toHaveBeenCalled();
    expect(prisma.taskChange.createMany).not.toHaveBeenCalled();
  });

  it('COMPLETED: the write only targets ids the caller owns, not the requested ones', async () => {
    const { prisma, service } = setup();
    prisma.task.findMany.mockResolvedValueOnce([taskRow({ id: 'mine' })]);
    prisma.task.updateMany.mockResolvedValue({ count: 1 });

    await service.bulkUpdateStatus('u1', ['mine', 'foreign'], 'COMPLETED');

    expect(whereOf(prisma.task.updateMany, 0)).toMatchObject({
      userId: 'u1',
      id: { in: ['mine'] },
    });
    // O desbloqueio dos dependentes tambem leva o userId.
    expect(whereOf(prisma.task.updateMany, 1)).toMatchObject({
      userId: 'u1',
      blockedByTaskId: { in: ['mine'] },
    });
  });

  it('reopen: both updateMany carry the userId', async () => {
    const { prisma, service } = setup();
    prisma.task.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 });

    const result = await service.bulkUpdateStatus('u1', ['x'], 'ON_TRACK');

    expect(result).toEqual({ count: 0 });
    expect(prisma.task.updateMany).toHaveBeenCalledTimes(2);
    for (const call of [0, 1]) {
      expect(whereOf(prisma.task.updateMany, call)).toMatchObject({
        userId: 'u1',
        id: { in: ['x'] },
      });
    }
  });

  it('reopen: clears completedAt only for COMPLETED rows, never for the others', async () => {
    const { prisma, service } = setup();
    prisma.task.updateMany.mockResolvedValue({ count: 0 });
    await service.bulkUpdateStatus('u1', ['x'], 'ON_TRACK');
    const calls = prisma.task.updateMany.mock.calls as [
      { where: Record<string, unknown>; data: Record<string, unknown> },
    ][];
    expect(calls[0][0].where.progressStatus).toBe('COMPLETED');
    expect(calls[0][0].data).toMatchObject({ completedAt: null });
    expect(calls[1][0].data).toEqual({ progressStatus: 'ON_TRACK' });
  });
});

describe('TasksService.bulkRemove / bulkReschedule ownership', () => {
  it('bulkRemove scopes the delete and the storage cleanup by userId', async () => {
    const { prisma, service, removeFilesForTasks } = setup();
    prisma.task.deleteMany.mockResolvedValue({ count: 1 });

    const result = await service.bulkRemove('u1', ['mine', 'foreign']);

    expect(result).toEqual({ count: 1 });
    expect(removeFilesForTasks).toHaveBeenCalledWith('u1', ['mine', 'foreign']);
    expect(whereOf(prisma.task.deleteMany)).toEqual({
      id: { in: ['mine', 'foreign'] },
      userId: 'u1',
    });
  });

  it('bulkRemove with only foreign ids deletes nothing', async () => {
    const { service } = setup();
    expect(await service.bulkRemove('u1', ['foreign'])).toEqual({ count: 0 });
  });

  it('bulkReschedule: every updateMany carries userId and skips COMPLETED', async () => {
    const { prisma, service } = setup();
    const result = await service.bulkReschedule(
      'u1',
      ['foreign'],
      new Date('2026-12-01T00:00:00.000Z'),
    );
    expect(result).toEqual({ count: 0 });
    expect(prisma.task.updateMany).toHaveBeenCalledTimes(3);
    for (let i = 0; i < 3; i++) {
      expect(whereOf(prisma.task.updateMany, i)).toMatchObject({
        userId: 'u1',
        id: { in: ['foreign'] },
        progressStatus: { not: 'COMPLETED' },
      });
    }
  });
});

describe('TasksService.bulkUpdateEffort edge cases', () => {
  it('an empty id list still keeps the userId in where', async () => {
    const { prisma, service } = setup();
    await service.bulkUpdateEffort('u1', [], 'LIGHT');
    expect(whereOf(prisma.task.updateMany)).toEqual({
      id: { in: [] },
      userId: 'u1',
    });
  });
});

describe('TasksService.reorder ownership', () => {
  it('rejects a list that repeats an owned id (count mismatch) without writing', async () => {
    const { prisma, service } = setup();
    // O findMany devolve 1 linha para 'a' mas a lista tem 2 entradas.
    prisma.task.findMany.mockResolvedValueOnce([{ id: 'a' }]);
    await expect(service.reorder('u1', ['a', 'a'])).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('looks the ids up scoped by userId', async () => {
    const { prisma, service } = setup();
    prisma.task.findMany.mockResolvedValueOnce([{ id: 'a' }]);
    await service.reorder('u1', ['a']);
    expect(whereOf(prisma.task.findMany)).toEqual({
      id: { in: ['a'] },
      userId: 'u1',
    });
  });

  it('pushes hidden tasks after the reordered ones, only the caller own', async () => {
    const { prisma, service } = setup();
    prisma.task.findMany.mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }]);
    await service.reorder('u1', ['a', 'b']);
    expect(prisma.task.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', id: { notIn: ['a', 'b'] } },
      data: { sortOrder: { increment: 2 } },
    });
  });

  it('the raw UPDATE takes the userId as a bound parameter, never in the text', async () => {
    const { prisma, service } = setup();
    const evil = 'u1"; DROP TABLE "Task"; --';
    prisma.task.findMany.mockResolvedValueOnce([{ id: 'a' }]);
    await service.reorder(evil, ['a']);
    const [strings, ...values] = prisma.$executeRaw.mock.calls[1] as [
      string[],
      ...unknown[],
    ];
    expect(strings.join('?')).not.toContain('DROP TABLE');
    expect(values).toContain(evil);
  });
});

describe('TasksService.applyCompletionSideEffects', () => {
  type Internals = {
    applyCompletionSideEffects: (
      userId: string,
      completed: { before: unknown; after: unknown }[],
    ) => Promise<unknown[]>;
  };
  const run = (service: TasksService, userId: string, rows: unknown[]) =>
    (service as unknown as Internals).applyCompletionSideEffects(
      userId,
      rows.map((row) => ({ before: row, after: row })),
    );

  it('empty list does no database work', async () => {
    const { prisma, service } = setup();
    expect(await run(service, 'u1', [])).toEqual([]);
    expect(prisma.task.updateMany).not.toHaveBeenCalled();
    expect(prisma.taskChange.createMany).not.toHaveBeenCalled();
  });

  it('unblock is scoped to the caller and to the completed ids only', async () => {
    const { prisma, service } = setup();
    await run(service, 'u1', [taskRow({ id: 'x' }), taskRow({ id: 'y' })]);
    expect(prisma.task.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'u1',
        blockedByTaskId: { in: ['x', 'y'] },
        isBlocked: true,
      },
      data: { isBlocked: false },
    });
  });

  it('never throws when unblocking fails', async () => {
    const { prisma, service } = setup();
    prisma.task.updateMany.mockRejectedValue(new Error('db down'));
    await expect(run(service, 'u1', [taskRow({ id: 'x' })])).resolves.toEqual(
      [],
    );
  });

  it('never throws when spawning fails (completion already saved)', async () => {
    const { prisma, service } = setup();
    prisma.task.findFirst.mockRejectedValue(new Error('boom'));
    await expect(
      run(service, 'u1', [taskRow({ id: 'x', recurrenceFrequency: 'WEEKLY' })]),
    ).resolves.toEqual([]);
  });

  it('spawned recurrence belongs to the caller, not to the owner on the row', async () => {
    const { prisma, service } = setup();
    const far = new Date(Date.now() + 5 * 24 * 3600 * 1000);
    await run(service, 'u1', [
      taskRow({
        id: 'x',
        userId: 'other',
        date: far,
        recurrenceFrequency: 'WEEKLY',
      }),
    ]);
    for (const call of prisma.task.create.mock.calls as [
      { data: { userId?: string; user?: unknown } },
    ][]) {
      const owner = call[0].data.userId ?? JSON.stringify(call[0].data.user);
      expect(String(owner)).toContain('u1');
      expect(String(owner)).not.toContain('other');
    }
  });
});
