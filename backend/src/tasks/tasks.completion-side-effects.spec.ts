// S-01/B-29 (bulk e check-in), S-02 (prazos de turma), B-25 (reorder SQL),
// S-28 (assertTaskOwned). Prisma mockado: sem base de dados.
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { assertTaskOwned } from './task-access';
import type { PrismaService } from '../prisma/prisma.service';
import type { PeriodsService } from '../academic-programs/periods.service';
import type { TaskMetaCacheService } from '../common/task-meta-cache.service';
import type { TaskAttachmentsService } from './task-attachments.service';

jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn() }));
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({})),
}));

const ACADEMIC = { id: 'tt-acad', key: 'ACADEMICO', isActive: true };

function taskRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 't1',
    userId: 'u1',
    areaId: 'a1',
    periodId: 'p1',
    title: 'Weekly quiz',
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
    taskTypeId: ACADEMIC.id,
    taskType: ACADEMIC,
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
      update: jest.fn(
        ({
          data,
          where,
        }: {
          data: Record<string, unknown>;
          where: { id: string };
        }) => Promise.resolve({ ...taskRow({ id: where.id }), ...data }),
      ),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ ...taskRow(), ...data, id: 'spawned' }),
      ),
      aggregate: jest.fn().mockResolvedValue({ _max: { sortOrder: 5 } }),
      count: jest.fn().mockResolvedValue(0),
    },
    taskChange: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
    taskType: {
      findUnique: jest.fn().mockResolvedValue(ACADEMIC),
    },
    academicTaskType: { findUnique: jest.fn().mockResolvedValue(null) },
    priority: { findUnique: jest.fn().mockResolvedValue(null) },
    user: {
      findUnique: jest.fn().mockResolvedValue({ spacedReviewsEnabled: false }),
    },
    gradeComponent: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { weightPercentage: 0 } }),
    },
    $executeRaw: jest.fn().mockResolvedValue(1),
    // Array (lote) ou callback (transacao interativa com o lock do user).
    $transaction: jest.fn((arg: unknown): Promise<unknown> => {
      if (typeof arg === 'function') {
        return (arg as (tx: unknown) => Promise<unknown>)(prisma);
      }
      return Promise.all(arg as unknown[]);
    }),
  };
  const service = new TasksService(
    prisma as unknown as PrismaService,
    {} as PeriodsService,
    {} as TaskMetaCacheService,
    {} as TaskAttachmentsService,
  );
  return { prisma, service };
}

describe('TasksService.bulkUpdateStatus COMPLETED (S-01/B-29)', () => {
  it('spawns the next occurrence of a recurring task and unblocks dependents', async () => {
    const { prisma, service } = setup();
    const recurring = taskRow({ id: 't1', recurrenceFrequency: 'WEEKLY' });
    prisma.task.findMany.mockResolvedValueOnce([
      recurring,
      taskRow({ id: 't2' }),
    ]);
    prisma.task.updateMany.mockResolvedValue({ count: 2 });

    const result = await service.bulkUpdateStatus(
      'u1',
      ['t1', 't2', 'foreign'],
      'COMPLETED',
    );

    expect(result).toEqual({ count: 2 });
    // Ownership is part of the read and of the write.
    expect(
      (prisma.task.findMany.mock.calls[0] as [{ where: unknown }])[0].where,
    ).toMatchObject({
      userId: 'u1',
    });
    expect(prisma.task.create).toHaveBeenCalledTimes(1);
    expect(prisma.task.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'u1',
        blockedByTaskId: { in: ['t1', 't2'] },
        isBlocked: true,
      },
      data: { isBlocked: false },
    });
  });

  it('records history for each completed task', async () => {
    const { prisma, service } = setup();
    prisma.task.findMany.mockResolvedValueOnce([taskRow({ id: 't1' })]);
    prisma.task.updateMany.mockResolvedValue({ count: 1 });

    await service.bulkUpdateStatus('u1', ['t1'], 'COMPLETED');

    const rows = (
      (prisma.taskChange.createMany.mock.calls[0] as [unknown])[0] as {
        data: { taskId: string; field: string }[];
      }
    ).data;
    expect(rows).toContainEqual(
      expect.objectContaining({ taskId: 't1', field: 'progressStatus' }),
    );
  });

  it('does nothing when no task is pending', async () => {
    const { prisma, service } = setup();
    expect(await service.bulkUpdateStatus('u1', ['t1'], 'COMPLETED')).toEqual({
      count: 0,
    });
    expect(prisma.task.updateMany).not.toHaveBeenCalled();
  });

  it('reopening runs both updateMany inside one $transaction', async () => {
    const { prisma, service } = setup();
    prisma.task.updateMany
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ count: 1 });

    const result = await service.bulkUpdateStatus('u1', ['a'], 'ON_TRACK');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ count: 3 });
  });
});

describe('TasksService.confirmOverdue (B-29)', () => {
  it('unblocks the tasks waiting for the one completed by the check-in', async () => {
    const { prisma, service } = setup();
    prisma.task.findFirst.mockResolvedValueOnce(taskRow());

    await service.confirmOverdue('u1', 't1', { isCompleted: true });

    expect(prisma.task.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', blockedByTaskId: { in: ['t1'] }, isBlocked: true },
      data: { isBlocked: false },
    });
  });
});

describe('TasksService.reorder (B-25)', () => {
  it('applies the order with a single scoped raw UPDATE', async () => {
    const { prisma, service } = setup();
    prisma.task.findMany.mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }]);

    await service.reorder('u1', ['a', 'b']);

    // 1.a chamada: lock do user (B-42); 2.a: o UPDATE com unnest.
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2);
    expect(
      (prisma.$executeRaw.mock.calls[0] as [string[]])[0].join('?'),
    ).toContain('pg_advisory_xact_lock');
    expect(prisma.task.update).not.toHaveBeenCalled();
    const [strings, ...values] = prisma.$executeRaw.mock.calls[1] as [
      string[],
      ...unknown[],
    ];
    expect(strings.join('?')).toContain('"userId"');
    expect(values).toEqual([['a', 'b'], [0, 1], 'u1']);
  });

  it('rejects ids that are not the caller own', async () => {
    const { prisma, service } = setup();
    prisma.task.findMany.mockResolvedValueOnce([{ id: 'a' }]);
    await expect(service.reorder('u1', ['a', 'b'])).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });
});

describe('TasksService.applyLinkedDeadlineChange (S-02)', () => {
  const later = new Date('2026-11-12T09:00:00Z');

  it('updates each task scoped by its own owner and records history', async () => {
    const { prisma, service } = setup();
    prisma.task.findMany.mockResolvedValueOnce([
      taskRow({ id: 'k1', userId: 'u1' }),
      taskRow({ id: 'k2', userId: 'u2' }),
    ]);

    await service.applyLinkedDeadlineChange(['k1', 'k2'], {
      title: 'Midterm',
      date: later,
    });

    const wheres = prisma.task.update.mock.calls.map(
      (c) => (c[0] as { where: unknown }).where,
    );
    expect(wheres).toEqual([
      { id: 'k1', userId: 'u1' },
      { id: 'k2', userId: 'u2' },
    ]);
    // Later date counts as a postponement, like update().
    expect(prisma.task.update.mock.calls[0][0].data).toMatchObject({
      postponedCount: { increment: 1 },
    });
    expect(prisma.taskChange.createMany).toHaveBeenCalled();
  });

  it('keeps the old weight for a member whose course would pass 100%', async () => {
    const { prisma, service } = setup();
    prisma.task.findMany
      // 1st: the linked tasks
      .mockResolvedValueOnce([
        taskRow({ id: 'k1', userId: 'u1', weightPercentage: 10 }),
        taskRow({ id: 'k2', userId: 'u2', weightPercentage: 10 }),
      ])
      // weight budget of u1 (fits) and u2 (full)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ title: 'x', weightPercentage: 90 }]);

    await service.applyLinkedDeadlineChange(['k1', 'k2'], {
      title: 'Midterm',
      date: later,
      weightPercentage: 40,
    });

    const [first, second] = prisma.task.update.mock.calls.map(
      (c) => (c[0] as { data: Record<string, unknown> }).data,
    );
    expect(first).toMatchObject({ weightPercentage: 40 });
    expect(second).not.toHaveProperty('weightPercentage');
    expect(second).toMatchObject({ title: 'Midterm' });
  });

  it('does not touch the database for an empty list', async () => {
    const { prisma, service } = setup();
    await service.applyLinkedDeadlineChange([], { title: 'x', date: later });
    expect(prisma.task.findMany).not.toHaveBeenCalled();
  });
});

describe('assertTaskOwned (S-28)', () => {
  it('scopes by userId and returns the row', async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: 't1' });
    const prisma = { task: { findFirst } } as unknown as Pick<
      PrismaService,
      'task'
    >;
    await expect(
      assertTaskOwned(prisma, 'u1', 't1', { select: { id: true } }),
    ).resolves.toEqual({ id: 't1' });
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 't1', userId: 'u1' },
      select: { id: true },
    });
  });

  it('throws 404 for a task that is not the caller own', async () => {
    const prisma = {
      task: { findFirst: jest.fn().mockResolvedValue(null) },
    } as unknown as Pick<PrismaService, 'task'>;
    await expect(assertTaskOwned(prisma, 'u1', 'other')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
