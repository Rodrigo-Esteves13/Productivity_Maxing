import { BadRequestException } from '@nestjs/common';
import { TasksService } from './tasks.service';

// file-type e ESM puro e o jest nao o carrega; aqui nao e usado.

jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn() }));

// So o findAll: os restantes colaboradores nao sao usados.
function setup(rows: Array<{ id: string }>, cursorFound = true) {
  const findMany = jest.fn().mockResolvedValue(rows);
  const findFirst = jest
    .fn()
    .mockResolvedValue(cursorFound ? { id: 'cursor' } : null);
  const service = Object.create(TasksService.prototype) as TasksService;
  Object.assign(service, {
    prisma: { task: { findMany, findFirst } },
    periodsService: {
      resolveActivePeriodId: jest.fn().mockResolvedValue('period-1'),
      findOwnedOrThrow: jest.fn(),
    },
    toResponse: (t: { id: string }) => t,
  });
  return { service, findMany, findFirst };
}

describe('TasksService.findAll pagination', () => {
  it('without cursor returns a plain array capped, scoped by userId', async () => {
    const { service, findMany } = setup([{ id: 't1' }]);
    const result = await service.findAll('user-1');
    expect(result).toEqual([{ id: 't1' }]);
    expect((findMany.mock.calls[0] as unknown[])[0]).toMatchObject({
      where: { userId: 'user-1', periodId: 'period-1' },
      take: 1001,
      orderBy: [{ sortOrder: 'asc' }, { date: 'asc' }, { id: 'asc' }],
    });
  });

  it('with cursor returns the envelope with nextCursor', async () => {
    const { service, findMany } = setup([
      { id: 't2' },
      { id: 't3' },
      { id: 't4' },
    ]);
    const result = await service.findAll('user-1', 'all', {
      cursor: 't1',
      limit: 2,
    });
    expect((findMany.mock.calls[0] as unknown[])[0]).toMatchObject({
      where: { userId: 'user-1' },
      take: 3,
      skip: 1,
      cursor: { id: 't1' },
    });
    expect(result).toEqual({
      items: [{ id: 't2' }, { id: 't3' }],
      nextCursor: 't3',
    });
  });

  it('last page has null nextCursor', async () => {
    const { service } = setup([{ id: 't1' }]);
    const result = await service.findAll('user-1', 'all', { paginated: true });
    expect(result).toEqual({ items: [{ id: 't1' }], nextCursor: null });
  });

  it('cursor is validated inside the same user/period scope', async () => {
    const { service, findFirst } = setup([{ id: 't2' }]);
    await service.findAll('user-1', 'all', { cursor: 't1' });
    expect(findFirst).toHaveBeenCalledWith({
      where: { userId: 'user-1', id: 't1' },
      select: { id: true },
    });
  });

  it('cursor lookup keeps the active period in scope', async () => {
    const { service, findFirst } = setup([{ id: 't2' }]);
    await service.findAll('user-1', undefined, { cursor: 't1' });
    expect(findFirst).toHaveBeenCalledWith({
      where: { userId: 'user-1', periodId: 'period-1', id: 't1' },
      select: { id: true },
    });
  });

  it('cursor lookup keeps an explicit (owned) period in scope', async () => {
    const { service, findFirst } = setup([{ id: 't2' }]);
    (
      service as unknown as {
        periodsService: { findOwnedOrThrow: jest.Mock };
      }
    ).periodsService.findOwnedOrThrow.mockResolvedValue({ id: 'period-2' });
    await service.findAll('user-1', 'period-2', { cursor: 't1' });
    expect(findFirst).toHaveBeenCalledWith({
      where: { userId: 'user-1', periodId: 'period-2', id: 't1' },
      select: { id: true },
    });
  });

  it('unknown, deleted or foreign cursor: 400 and no list query', async () => {
    const { service, findMany } = setup([{ id: 't2' }], false);
    await expect(
      service.findAll('user-1', 'all', { cursor: 'nope' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('flags truncation in meta when the array hit the cap', async () => {
    const many = Array.from({ length: 1001 }, (_, i) => ({ id: `t${i}` }));
    const { service } = setup(many);
    const meta: { truncated?: boolean } = {};
    const result = await service.findAll('user-1', 'all', {}, meta);
    expect(result).toHaveLength(1000);
    expect(meta.truncated).toBe(true);
  });
});
