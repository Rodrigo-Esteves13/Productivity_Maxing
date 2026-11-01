// Silent-bug audit (area b) - repro tests. Each test FAILS while the bug
// exists. Safe to delete once the bugs are fixed (or keep as regression).
import { TasksService } from './tasks.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { PeriodsService } from '../academic-programs/periods.service';
import type { TaskMetaCacheService } from '../common/task-meta-cache.service';
import type { TaskAttachmentsService } from './task-attachments.service';

jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn() }));
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({})),
}));

const ACADEMIC = { id: 'tt-acad', key: 'ACADEMICO', isActive: true };
const PERSONAL = { id: 'tt-pers', key: 'PESSOAL', isActive: true };
const FREQ = {
  id: 'at-freq',
  key: 'FREQUENCIA',
  isActive: true,
  isEvent: false,
  taskTypeId: ACADEMIC.id,
};

function taskRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 't1',
    userId: 'u1',
    areaId: 'a1',
    periodId: 'p1',
    title: 'Weekly quiz',
    date: new Date('2026-10-01T00:00:00.000Z'),
    progressStatus: 'ON_TRACK',
    completedAt: null,
    weightPercentage: null,
    difficulty: 'MEDIUM',
    isPinned: false,
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
    priorityId: 'prio-high',
    priority: {
      id: 'prio-high',
      key: 'HIGH',
      label: 'High',
      colorHex: '#f00',
      order: 1,
    },
    area: { id: 'a1', name: 'Calc' },
    subtasks: [],
    ...overrides,
  };
}

function setup(existing: ReturnType<typeof taskRow>) {
  const prisma = {
    task: {
      findFirst: jest
        .fn()
        .mockResolvedValueOnce(existing)
        .mockResolvedValue(null),
      update: jest.fn(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ ...existing, ...data }),
      ),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ ...existing, ...data, id: 'spawned' }),
      ),
      aggregate: jest.fn().mockResolvedValue({ _max: { sortOrder: 5 } }),
      count: jest.fn().mockResolvedValue(0),
    },
    taskType: {
      findUnique: jest.fn(({ where }: { where: { key: string } }) =>
        Promise.resolve(
          [ACADEMIC, PERSONAL].find((t) => t.key === where.key) ?? null,
        ),
      ),
    },
    academicTaskType: {
      findUnique: jest.fn(({ where }: { where: { key: string } }) =>
        Promise.resolve(where.key === FREQ.key ? FREQ : null),
      ),
    },
    priority: { findUnique: jest.fn().mockResolvedValue(null) },
    user: {
      findUnique: jest.fn().mockResolvedValue({ spacedReviewsEnabled: false }),
    },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
  };
  const service = new TasksService(
    prisma as unknown as PrismaService,
    {} as PeriodsService,
    {} as TaskMetaCacheService,
    {} as TaskAttachmentsService,
  );
  return { prisma, service };
}

describe('silent-audit b: TasksService', () => {
  it('B-01: completing a recurring task via the overdue check-in creates the next occurrence', async () => {
    const existing = taskRow({ recurrenceFrequency: 'WEEKLY' });
    const { prisma, service } = setup(existing);

    await service.confirmOverdue('u1', 't1', { isCompleted: true });

    // update() (normal completion) calls spawnFollowUps -> task.create for
    // the next occurrence. confirmOverdue() never does, so the series ends.
    expect(prisma.task.create).toHaveBeenCalled();
  });

  it('B-01 control (passes): completing the same task via PATCH /tasks/:id does create it', async () => {
    const existing = taskRow({ recurrenceFrequency: 'WEEKLY' });
    const { prisma, service } = setup(existing);

    await service.update('u1', 't1', { progressStatus: 'COMPLETED' });

    expect(prisma.task.create).toHaveBeenCalled();
  });

  it('B-02: choosing "No priority" in the edit form clears the stored priority', async () => {
    const { prisma, service } = setup(taskRow());

    // TaskEditForm sends priority: '' for the "No priority" option.
    await service.update('u1', 't1', { priority: '' });

    const data = prisma.task.update.mock.calls[0][0].data;
    expect(data).toHaveProperty('priorityId', null);
  });

  it('B-03: changing type away from ACADEMICO (subcategory cleared by the form) is accepted', async () => {
    const { service } = setup(
      taskRow({ academicTypeId: FREQ.id, academicType: FREQ }),
    );

    // TaskFormFields clears academicType when the type changes, and
    // buildTaskPayload turns '' into undefined, so the PATCH carries only
    // the new type. The service then re-uses the OLD subcategory and 400s.
    await expect(
      service.update('u1', 't1', {
        type: PERSONAL.key,
        academicType: undefined,
      }),
    ).resolves.toBeDefined();
  });
});

describe('NOT_STARTED is display-only for locked tasks', () => {
  it('ignores NOT_STARTED echoed back by the edit form of a blocked task', async () => {
    const { prisma, service } = setup(
      taskRow({
        isBlocked: true,
        availableFrom: null,
        progressStatus: 'BEHIND',
      }),
    );

    await service.update('u1', 't1', {
      progressStatus: 'NOT_STARTED',
      title: 'Renamed',
    });

    const data = prisma.task.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('progressStatus');
    expect(data).toHaveProperty('title', 'Renamed');
  });

  it('still stores NOT_STARTED when the user picks it on an unlocked task', async () => {
    const { prisma, service } = setup(
      taskRow({ isBlocked: false, availableFrom: null }),
    );

    await service.update('u1', 't1', { progressStatus: 'NOT_STARTED' });

    const data = prisma.task.update.mock.calls[0][0].data;
    expect(data).toHaveProperty('progressStatus', 'NOT_STARTED');
  });
});
