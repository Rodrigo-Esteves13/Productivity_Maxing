import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TaskTypesService } from './task-types.service';

function setup() {
  const prisma = {
    taskType: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    academicTaskType: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  const cache = { invalidate: jest.fn() };
  const service = new TaskTypesService(prisma as never, cache as never);
  return { service, prisma, cache };
}

describe('TaskTypesService task types', () => {
  it('findAll filters active only when asked', async () => {
    const { service, prisma } = setup();
    prisma.taskType.findMany.mockResolvedValue([]);
    await service.findAllTaskTypes(true);
    expect(prisma.taskType.findMany).toHaveBeenLastCalledWith({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      include: { academicTaskTypes: true },
    });
    await service.findAllTaskTypes(false);
    expect(prisma.taskType.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: undefined }),
    );
  });

  it('create suffixes key on collision and invalidates after write', async () => {
    const { service, prisma, cache } = setup();
    prisma.taskType.findUnique
      .mockResolvedValueOnce({ id: 'x' })
      .mockResolvedValueOnce(null);
    prisma.taskType.create.mockResolvedValue({ id: 'n' });
    await service.createTaskType({ label: 'Exam' });
    const keys = (
      prisma.taskType.findUnique.mock.calls as [{ where: { key: string } }][]
    ).map((c) => c[0].where.key);
    expect(keys[1]).toBe(`${keys[0]}_2`);
    expect(prisma.taskType.create).toHaveBeenCalledWith({
      data: { label: 'Exam', key: keys[1] },
    });
    expect(cache.invalidate).toHaveBeenCalledTimes(1);
  });

  it('create failure does not invalidate', async () => {
    const { service, prisma, cache } = setup();
    prisma.taskType.findUnique.mockResolvedValue(null);
    prisma.taskType.create.mockRejectedValue(new Error('db'));
    await expect(service.createTaskType({ label: 'Exam' })).rejects.toThrow(
      'db',
    );
    expect(cache.invalidate).not.toHaveBeenCalled();
  });

  it('update and remove on missing id give NotFound without writing', async () => {
    const { service, prisma, cache } = setup();
    prisma.taskType.findUnique.mockResolvedValue(null);
    await expect(
      service.updateTaskType('n', { label: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.removeTaskType('n')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.taskType.update).not.toHaveBeenCalled();
    expect(cache.invalidate).not.toHaveBeenCalled();
  });

  it('update writes by id; remove is soft delete', async () => {
    const { service, prisma, cache } = setup();
    prisma.taskType.findUnique.mockResolvedValue({ id: 't1' });
    prisma.taskType.update.mockResolvedValue({});
    await service.updateTaskType('t1', { label: 'y' });
    expect(prisma.taskType.update).toHaveBeenLastCalledWith({
      where: { id: 't1' },
      data: { label: 'y' },
    });
    await service.removeTaskType('t1');
    expect(prisma.taskType.update).toHaveBeenLastCalledWith({
      where: { id: 't1' },
      data: { isActive: false },
    });
    expect(cache.invalidate).toHaveBeenCalledTimes(2);
  });
});

describe('TaskTypesService academic task types', () => {
  it('findAll filters active only when asked', async () => {
    const { service, prisma } = setup();
    prisma.academicTaskType.findMany.mockResolvedValue([]);
    await service.findAllAcademicTaskTypes(true);
    expect(prisma.academicTaskType.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      include: { taskType: true },
    });
  });

  it('create with unknown parent gives BadRequest and no write', async () => {
    const { service, prisma, cache } = setup();
    prisma.taskType.findUnique.mockResolvedValue(null);
    await expect(
      service.createAcademicTaskType({
        label: 'Quiz',
        taskTypeId: 'tt',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.academicTaskType.create).not.toHaveBeenCalled();
    expect(cache.invalidate).not.toHaveBeenCalled();
  });

  it('create links parent, generates key, invalidates', async () => {
    const { service, prisma, cache } = setup();
    prisma.taskType.findUnique.mockResolvedValue({ id: 'tt' });
    prisma.academicTaskType.findUnique.mockResolvedValue(null);
    prisma.academicTaskType.create.mockResolvedValue({ id: 'a1' });
    await service.createAcademicTaskType({
      label: 'Quiz',
      taskTypeId: 'tt',
      order: 2,
    });
    const call = (
      prisma.academicTaskType.create.mock.calls as [
        { data: { key: unknown }; include: unknown },
      ][]
    )[0][0];
    expect(call.data).toEqual(
      expect.objectContaining({ label: 'Quiz', taskTypeId: 'tt', order: 2 }),
    );
    expect(typeof call.data.key).toBe('string');
    expect(call.include).toEqual({ taskType: true });
    expect(cache.invalidate).toHaveBeenCalledTimes(1);
  });

  it('update missing id gives NotFound', async () => {
    const { service, prisma } = setup();
    prisma.academicTaskType.findUnique.mockResolvedValue(null);
    await expect(
      service.updateAcademicTaskType('n', {}),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.academicTaskType.update).not.toHaveBeenCalled();
  });

  it('update with unknown new parent gives BadRequest', async () => {
    const { service, prisma, cache } = setup();
    prisma.academicTaskType.findUnique.mockResolvedValue({ id: 'a1' });
    prisma.taskType.findUnique.mockResolvedValue(null);
    await expect(
      service.updateAcademicTaskType('a1', { taskTypeId: 'bad' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.academicTaskType.update).not.toHaveBeenCalled();
    expect(cache.invalidate).not.toHaveBeenCalled();
  });

  it('update without parent change skips parent lookup', async () => {
    const { service, prisma, cache } = setup();
    prisma.academicTaskType.findUnique.mockResolvedValue({ id: 'a1' });
    prisma.academicTaskType.update.mockResolvedValue({});
    await service.updateAcademicTaskType('a1', { label: 'z' });
    expect(prisma.taskType.findUnique).not.toHaveBeenCalled();
    expect(prisma.academicTaskType.update).toHaveBeenCalledWith({
      where: { id: 'a1' },
      data: { label: 'z' },
      include: { taskType: true },
    });
    expect(cache.invalidate).toHaveBeenCalledTimes(1);
  });

  it('remove soft deletes; missing gives NotFound', async () => {
    const { service, prisma, cache } = setup();
    prisma.academicTaskType.findUnique.mockResolvedValueOnce(null);
    await expect(service.removeAcademicTaskType('n')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    prisma.academicTaskType.findUnique.mockResolvedValue({ id: 'a1' });
    prisma.academicTaskType.update.mockResolvedValue({});
    await service.removeAcademicTaskType('a1');
    expect(prisma.academicTaskType.update).toHaveBeenCalledWith({
      where: { id: 'a1' },
      data: { isActive: false },
    });
    expect(cache.invalidate).toHaveBeenCalledTimes(1);
  });
});
