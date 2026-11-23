import { NotFoundException } from '@nestjs/common';
import { PrioritiesService } from './priorities.service';

function setup() {
  const prisma = {
    priority: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  const cache = { invalidate: jest.fn() };
  const service = new PrioritiesService(prisma as never, cache as never);
  return { service, prisma, cache };
}

describe('PrioritiesService', () => {
  it('findAll filters active only when asked, ordered', async () => {
    const { service, prisma } = setup();
    prisma.priority.findMany.mockResolvedValue([]);
    await service.findAll(true);
    expect(prisma.priority.findMany).toHaveBeenLastCalledWith({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });
    await service.findAll(false);
    expect(prisma.priority.findMany).toHaveBeenLastCalledWith({
      where: undefined,
      orderBy: { order: 'asc' },
    });
  });

  it('create adds numeric suffix until key is free and invalidates cache after write', async () => {
    const { service, prisma, cache } = setup();
    prisma.priority.findUnique
      .mockResolvedValueOnce({ id: 'x' })
      .mockResolvedValueOnce({ id: 'y' })
      .mockResolvedValueOnce(null);
    prisma.priority.create.mockResolvedValue({ id: 'new' });

    await service.create({ label: 'High', order: 1 });

    const keys = (
      prisma.priority.findUnique.mock.calls as [{ where: { key: string } }][]
    ).map((c) => c[0].where.key);
    expect(keys[1]).toBe(`${keys[0]}_2`);
    expect(keys[2]).toBe(`${keys[0]}_3`);
    expect(prisma.priority.create).toHaveBeenCalledWith({
      data: { label: 'High', order: 1, key: keys[2] },
    });
    expect(cache.invalidate).toHaveBeenCalledTimes(1);
  });

  it('create failure leaves cache untouched', async () => {
    const { service, prisma, cache } = setup();
    prisma.priority.findUnique.mockResolvedValue(null);
    prisma.priority.create.mockRejectedValue(new Error('db'));
    await expect(service.create({ label: 'High' })).rejects.toThrow('db');
    expect(cache.invalidate).not.toHaveBeenCalled();
  });

  it('update missing id gives NotFound, no write, no invalidate', async () => {
    const { service, prisma, cache } = setup();
    prisma.priority.findUnique.mockResolvedValue(null);
    await expect(service.update('nope', { label: 'x' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.priority.update).not.toHaveBeenCalled();
    expect(cache.invalidate).not.toHaveBeenCalled();
  });

  it('update writes dto by id and invalidates', async () => {
    const { service, prisma, cache } = setup();
    prisma.priority.findUnique.mockResolvedValue({ id: 'p1' });
    prisma.priority.update.mockResolvedValue({ id: 'p1', label: 'x' });
    await service.update('p1', { label: 'x' });
    expect(prisma.priority.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { label: 'x' },
    });
    expect(cache.invalidate).toHaveBeenCalledTimes(1);
  });

  it('remove is a soft delete', async () => {
    const { service, prisma, cache } = setup();
    prisma.priority.findUnique.mockResolvedValue({ id: 'p1' });
    prisma.priority.update.mockResolvedValue({ id: 'p1', isActive: false });
    await service.remove('p1');
    expect(prisma.priority.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { isActive: false },
    });
    expect(cache.invalidate).toHaveBeenCalledTimes(1);
  });

  it('remove missing id gives NotFound', async () => {
    const { service, prisma, cache } = setup();
    prisma.priority.findUnique.mockResolvedValue(null);
    await expect(service.remove('nope')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.priority.update).not.toHaveBeenCalled();
    expect(cache.invalidate).not.toHaveBeenCalled();
  });
});
