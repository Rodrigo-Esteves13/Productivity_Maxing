// B-42 (lock por user a volta de peso + sortOrder + insert), B-36 (peso do
// import com groupBy) e B-43 (posse na escrita). Prisma mockado: sem BD.
import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { PeriodsService } from '../academic-programs/periods.service';
import type { TaskMetaCacheService } from '../common/task-meta-cache.service';
import type { TaskAttachmentsService } from './task-attachments.service';
import type { CreateTaskDto } from './dto/create-task.dto';
import type { ImportTasksDto } from './dto/import-tasks.dto';

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
    title: 'Essay',
    date: new Date('2026-12-01T00:00:00.000Z'),
    dateCertainty: 'EXACT',
    progressStatus: 'ON_TRACK',
    completedAt: null,
    weightPercentage: null,
    difficulty: 'MEDIUM',
    isPinned: false,
    isBlocked: false,
    blockedByTaskId: null,
    submissionDate: null,
    availableFrom: null,
    topics: null,
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

/**
 * `log` guarda a ordem das operacoes: o lock tem de vir antes da leitura do
 * peso, que vem antes do sortOrder, que vem antes do insert.
 */
function setup() {
  const log: string[] = [];
  const track =
    <T>(name: string, value: T) =>
    () => {
      log.push(name);
      return Promise.resolve(value);
    };
  const prisma = {
    task: {
      findFirst: jest.fn(track<unknown>('task.findFirst', null)),
      findMany: jest.fn(track('task.findMany', [] as unknown[])),
      aggregate: jest.fn(track('task.aggregate', { _max: { sortOrder: 7 } })),
      groupBy: jest.fn(track('task.groupBy', [] as unknown[])),
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        log.push('task.create');
        return Promise.resolve({ ...taskRow(), ...data, id: 'new' });
      }),
      update: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        log.push('task.update');
        return Promise.resolve({ ...taskRow(), ...data });
      }),
      createManyAndReturn: jest.fn(
        ({ data }: { data: Record<string, unknown>[] }) => {
          log.push('task.createManyAndReturn');
          return Promise.resolve(data.map((_, i) => ({ id: `imp-${i}` })));
        },
      ),
    },
    gradeComponent: {
      aggregate: jest.fn(
        track('gradeComponent.aggregate', { _sum: { weightPercentage: 0 } }),
      ),
      groupBy: jest.fn(track('gradeComponent.groupBy', [] as unknown[])),
    },
    subtask: {
      findFirst: jest.fn(),
      delete: jest.fn(track('subtask.delete', {})),
    },
    taskChange: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
    area: {
      findFirst: jest.fn().mockResolvedValue({ id: 'a1' }),
      findMany: jest.fn().mockResolvedValue([{ id: 'a1' }]),
    },
    taskType: {
      findUnique: jest.fn().mockResolvedValue(ACADEMIC),
      findMany: jest.fn().mockResolvedValue([ACADEMIC]),
    },
    academicTaskType: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    academicPeriod: { findMany: jest.fn().mockResolvedValue([]) },
    priority: { findUnique: jest.fn().mockResolvedValue(null) },
    user: {
      findUnique: jest.fn().mockResolvedValue({ spacedReviewsEnabled: false }),
    },
    $executeRaw: jest.fn((strings: TemplateStringsArray) => {
      log.push(strings.join('?').includes('pg_advisory') ? 'lock' : 'raw');
      return Promise.resolve(1);
    }),
    $transaction: jest.fn(),
  };
  // Transacao interativa: corre o callback com o proprio mock como tx.
  prisma.$transaction.mockImplementation((arg: unknown) => {
    if (typeof arg === 'function') {
      log.push('transaction');
      return (arg as (tx: unknown) => Promise<unknown>)(prisma);
    }
    return Promise.all(arg as unknown[]);
  });
  const periods = {
    resolveActivePeriodId: jest.fn().mockResolvedValue('p1'),
    findOwnedOrThrow: jest.fn().mockResolvedValue({ id: 'p1' }),
  };
  const service = new TasksService(
    prisma as unknown as PrismaService,
    periods as unknown as PeriodsService,
    {} as TaskMetaCacheService,
    {} as TaskAttachmentsService,
  );
  return { prisma, service, log };
}

const DTO: CreateTaskDto = {
  areaId: 'a1',
  title: 'Essay',
  date: '2026-12-01T00:00:00.000Z',
  type: 'ACADEMICO',
  difficulty: 'MEDIUM',
  weightPercentage: 30,
};

const before = (log: string[], first: string, second: string) =>
  log.indexOf(first) >= 0 &&
  log.indexOf(second) >= 0 &&
  log.indexOf(first) < log.indexOf(second);

describe('TasksService.create (B-42)', () => {
  it('takes the user lock before the weight check, then sortOrder, then insert', async () => {
    const { prisma, service, log } = setup();

    await service.create('u1', DTO);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const [strings, ...values] = prisma.$executeRaw.mock.calls[0] as [
      TemplateStringsArray,
      ...unknown[],
    ];
    expect(strings.join('?')).toContain('pg_advisory_xact_lock(hashtext(');
    // userId vai como parametro, nunca no texto do SQL.
    expect(values).toEqual(['u1']);
    expect(before(log, 'transaction', 'lock')).toBe(true);
    expect(before(log, 'lock', 'task.findMany')).toBe(true);
    expect(before(log, 'lock', 'gradeComponent.aggregate')).toBe(true);
    expect(before(log, 'task.findMany', 'task.aggregate')).toBe(true);
    expect(before(log, 'task.aggregate', 'task.create')).toBe(true);
    const data = (
      prisma.task.create.mock.calls[0] as [
        { data: { sortOrder: number; userId: string } },
      ]
    )[0].data;
    expect(data).toMatchObject({ sortOrder: 8, userId: 'u1' });
  });

  it('rejects a weight over 100% inside the lock and never inserts', async () => {
    const { prisma, service, log } = setup();
    prisma.task.findMany.mockResolvedValueOnce([
      { title: 'Exam', weightPercentage: 80, recurrenceFrequency: null },
    ]);

    await expect(service.create('u1', DTO)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(log).toContain('lock');
    expect(prisma.task.aggregate).not.toHaveBeenCalled();
    expect(prisma.task.create).not.toHaveBeenCalled();
  });

  it('reuses the caller transaction instead of opening a nested one', async () => {
    const { prisma, service } = setup();
    const tx = {
      task: {
        findMany: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({ _max: { sortOrder: null } }),
        create: jest.fn(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ ...taskRow(), ...data }),
        ),
      },
      gradeComponent: {
        aggregate: jest
          .fn()
          .mockResolvedValue({ _sum: { weightPercentage: 0 } }),
      },
      $executeRaw: jest.fn().mockResolvedValue(1),
    };

    await service.create('u1', DTO, {
      tx: tx as never,
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.task.create).not.toHaveBeenCalled();
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.task.create.mock.calls[0][0].data).toMatchObject({
      sortOrder: 1,
    });
  });

  it('keeps DB errors generic (500) and outside the response body', async () => {
    const { prisma, service } = setup();
    prisma.task.create.mockRejectedValueOnce(new Error('column "x" leaked'));
    await expect(service.create('u1', DTO)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });
});

describe('TasksService.update weight under the lock (B-42)', () => {
  it('validates a weight increase and writes inside the same locked transaction', async () => {
    const { prisma, service, log } = setup();
    prisma.task.findFirst.mockResolvedValueOnce(
      taskRow({ weightPercentage: 10 }),
    );

    await service.update('u1', 't1', { weightPercentage: 40 });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(before(log, 'lock', 'task.findMany')).toBe(true);
    expect(before(log, 'task.findMany', 'task.update')).toBe(true);
    expect(prisma.task.update.mock.calls[0][0]).toMatchObject({
      where: { id: 't1', userId: 'u1' },
    });
  });

  it('a title-only edit needs no lock', async () => {
    const { prisma, service } = setup();
    prisma.task.findFirst.mockResolvedValueOnce(taskRow());

    await service.update('u1', 't1', { title: 'Renamed' });

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
    expect(prisma.task.update).toHaveBeenCalledTimes(1);
  });
});

describe('TasksService.createFromSubtask (B-42, B-43)', () => {
  it('computes sortOrder under the lock and deletes the step scoped by owner', async () => {
    const { prisma, service, log } = setup();
    prisma.task.findFirst.mockResolvedValueOnce(taskRow());
    prisma.subtask.findFirst.mockResolvedValueOnce({
      id: 's1',
      title: 'Outline',
      isDone: false,
    });

    await service.createFromSubtask('u1', 't1', 's1');

    expect(before(log, 'lock', 'task.aggregate')).toBe(true);
    expect(before(log, 'task.aggregate', 'task.create')).toBe(true);
    expect(prisma.subtask.delete).toHaveBeenCalledWith({
      where: { id: 's1', taskId: 't1', task: { userId: 'u1' } },
    });
  });
});

describe('TasksService.importTasks (B-36, B-42)', () => {
  const sheet = (weights: number[]): ImportTasksDto => ({
    tasks: weights.map((weightPercentage, i) => ({
      title: `Row ${i + 1}`,
      date: '2026-12-01T00:00:00.000Z',
      type: 'ACADEMICO',
      areaId: 'a1',
      weightPercentage,
    })),
  });

  it('loads the used weight with groupBy once per period, inside the lock', async () => {
    const { prisma, service, log } = setup();
    // 60% ja usado na cadeira: uma tarefa normal + uma serie recorrente.
    const grouped = (rows: unknown[]) => () => {
      log.push('task.groupBy');
      return Promise.resolve(rows);
    };
    prisma.task.groupBy
      .mockImplementationOnce(
        grouped([{ areaId: 'a1', _sum: { weightPercentage: 40 } }]),
      )
      .mockImplementationOnce(
        grouped([
          { areaId: 'a1', title: 'Quiz', _max: { weightPercentage: 20 } },
        ]),
      );

    const result = await service.importTasks('u1', sheet([30, 20]));

    // 3 groupBy (tasks normais, series, componentes), nunca um por cadeira.
    expect(prisma.task.groupBy).toHaveBeenCalledTimes(2);
    expect(prisma.gradeComponent.groupBy).toHaveBeenCalledTimes(1);
    expect(prisma.task.findMany).not.toHaveBeenCalled();
    expect(
      (prisma.task.groupBy.mock.calls[0] as unknown as [{ where: unknown }])[0]
        .where,
    ).toMatchObject({ userId: 'u1', periodId: 'p1', areaId: { in: ['a1'] } });
    expect(before(log, 'lock', 'task.groupBy')).toBe(true);
    expect(before(log, 'task.groupBy', 'task.aggregate')).toBe(true);
    expect(before(log, 'task.aggregate', 'task.createManyAndReturn')).toBe(
      true,
    );
    // 40% livres: a 1.a linha (30) entra, a 2.a (20) ja nao cabe.
    expect(result.created).toBe(1);
    expect(result.results[1]).toMatchObject({ row: 2, success: false });
    const inserted = (
      prisma.task.createManyAndReturn.mock.calls[0] as [
        { data: { sortOrder: number }[] },
      ]
    )[0].data;
    expect(inserted.map((row) => row.sortOrder)).toEqual([8]);
  });

  it('falls back to row by row when the bulk insert fails', async () => {
    const { prisma, service } = setup();
    prisma.task.createManyAndReturn.mockRejectedValueOnce(new Error('fk'));

    const result = await service.importTasks('u1', sheet([10, 10]));

    expect(prisma.task.create).toHaveBeenCalledTimes(2);
    expect(result.created).toBe(2);
  });

  it('rethrows when the transaction fails before any row is validated', async () => {
    const { prisma, service } = setup();
    prisma.$executeRaw.mockRejectedValueOnce(new Error('db down'));

    await expect(service.importTasks('u1', sheet([10]))).rejects.toThrow(
      'db down',
    );
    expect(prisma.task.create).not.toHaveBeenCalled();
  });
});
