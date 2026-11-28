import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { restoreTasks } from './restore-tasks.util';
import { RestoreTasksDto, type RestoreTaskDto } from './dto/restore-tasks.dto';
import { TASK_RESTORE_BATCH_MAX } from './tasks.constants';

const USER = 'user-1';

const item = (extra: Partial<RestoreTaskDto> = {}): RestoreTaskDto =>
  ({
    areaId: 'area-1',
    title: 'T',
    date: '2026-11-01T00:00:00Z',
    type: 'ACADEMICO',
    difficulty: 'EASY',
    ...extra,
  }) as unknown as RestoreTaskDto;

function setup() {
  const create = jest.fn((_userId: string, dto: { title: string }) =>
    dto.title === 'bad'
      ? Promise.reject(new Error('no access'))
      : Promise.resolve({ id: `new-${dto.title}` }),
  );
  const prisma = {
    subtask: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      findMany: jest.fn().mockResolvedValue([{ id: 's1' }]),
    },
  };
  const logger = { warn: jest.fn() };
  const run = (items: RestoreTaskDto[]) =>
    restoreTasks(
      {
        prisma: prisma as never,
        create: create as never,
        logger: logger as never,
      },
      USER,
      items,
    );
  return { create, prisma, run };
}

describe('restoreTasks', () => {
  it('creates each task for the caller and reports the failed positions', async () => {
    const { create, run } = setup();
    const result = await run([
      item({ title: 'a' }),
      item({ title: 'bad' }),
      item({ title: 'c' }),
    ]);
    expect(create.mock.calls.every(([userId]) => userId === USER)).toBe(true);
    expect(result.failed).toEqual([1]);
    expect(result.restored.map((r) => r.index)).toEqual([0, 2]);
  });

  it('does not touch subtasks of a task that failed ownership', async () => {
    const { prisma, run } = setup();
    await run([
      item({ title: 'bad', subtasks: [{ title: 'x', isDone: true }] }),
    ]);
    expect(prisma.subtask.createMany).not.toHaveBeenCalled();
  });

  it('keeps the checklist state and scopes the read to the user', async () => {
    const { prisma, run } = setup();
    await run([item({ subtasks: [{ title: 'x', isDone: true }] })]);
    expect(prisma.subtask.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          taskId: 'new-T',
          isDone: true,
          sortOrder: 0,
        }),
      ],
    });
    expect(prisma.subtask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { taskId: 'new-T', task: { userId: USER } },
      }),
    );
  });

  it('keeps a past completedAt and ignores a future one', async () => {
    const { create, run } = setup();
    await run([
      item({ completedAt: '2020-01-02T00:00:00Z' }),
      item({ completedAt: '2999-01-01T00:00:00Z' }),
    ]);
    expect(create.mock.calls[0]).toEqual([
      USER,
      expect.not.objectContaining({
        completedAt: expect.anything() as unknown,
      }) as unknown,
      { completedAt: new Date('2020-01-02T00:00:00Z') },
    ]);
    expect(create.mock.calls[1]).toEqual([
      USER,
      expect.anything(),
      { completedAt: undefined },
    ]);
  });
});

describe('RestoreTasksDto', () => {
  const check = (tasks: unknown[]) =>
    validate(plainToInstance(RestoreTasksDto, { tasks }), {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

  it('accepts a full batch and rejects a larger or empty one', async () => {
    const batch = Array.from({ length: TASK_RESTORE_BATCH_MAX }, () => item());
    expect(await check(batch)).toHaveLength(0);
    expect(await check([...batch, item()])).not.toHaveLength(0);
    expect(await check([])).not.toHaveLength(0);
  });

  it('validates nested items and rejects userId', async () => {
    expect(await check([item({ title: '' })])).not.toHaveLength(0);
    expect(await check([{ ...item(), userId: 'other' }])).not.toHaveLength(0);
  });
});
