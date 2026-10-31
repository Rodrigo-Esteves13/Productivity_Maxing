import { TasksService } from './tasks.service';

// file-type e ESM puro e o jest nao o carrega; aqui nao e usado.
jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn() }));

function setup(count = 2) {
  const updateMany = jest.fn().mockResolvedValue({ count });
  const service = Object.create(TasksService.prototype) as TasksService;
  Object.assign(service, { prisma: { task: { updateMany } } });
  return { service, updateMany };
}

describe('TasksService.bulkUpdateEffort', () => {
  it('updates own tasks, scoped by userId', async () => {
    const { service, updateMany } = setup(2);
    const result = await service.bulkUpdateEffort(
      'user-1',
      ['a', 'b'],
      'HEAVY',
    );
    expect(result).toEqual({ count: 2 });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['a', 'b'] }, userId: 'user-1' },
      data: { effort: 'HEAVY' },
    });
  });

  it('foreign ids never match: count 0 and the where keeps the owner', async () => {
    const { service, updateMany } = setup(0);
    const result = await service.bulkUpdateEffort(
      'user-1',
      ['foreign'],
      'LIGHT',
    );
    expect(result).toEqual({ count: 0 });
    const args = (
      updateMany.mock.calls[0] as [{ where: { userId: string } }]
    )[0];
    expect(args.where.userId).toBe('user-1');
  });

  it('null clears the effort', async () => {
    const { service, updateMany } = setup(1);
    await service.bulkUpdateEffort('user-1', ['a'], null);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['a'] }, userId: 'user-1' },
      data: { effort: null },
    });
  });
});
