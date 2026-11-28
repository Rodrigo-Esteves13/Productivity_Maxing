import { NotFoundException } from '@nestjs/common';
import { AreaInterestsService } from './area-interests.service';

const USER = 'user-1';
const AREA = 'area-1';

function setup() {
  const prisma = {
    area: { findFirst: jest.fn() },
    areaInterest: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
  const service = new AreaInterestsService(prisma as never);
  return { service, prisma };
}

describe('AreaInterestsService', () => {
  it('list is scoped to the caller', async () => {
    const { service, prisma } = setup();
    prisma.areaInterest.findMany.mockResolvedValue([
      { areaId: AREA, rating: 4 },
    ]);
    await expect(service.list(USER)).resolves.toEqual([
      { areaId: AREA, rating: 4 },
    ]);
    expect(prisma.areaInterest.findMany).toHaveBeenCalledWith({
      where: { userId: USER },
      select: { areaId: true, rating: true },
    });
  });

  it('set checks area access for caller then upserts on caller key', async () => {
    const { service, prisma } = setup();
    prisma.area.findFirst.mockResolvedValue({ id: AREA });
    prisma.areaInterest.upsert.mockResolvedValue({ areaId: AREA, rating: 5 });
    await service.set(USER, AREA, 5);
    expect(prisma.area.findFirst).toHaveBeenCalledWith({
      where: { id: AREA, OR: [{ ownerId: null }, { ownerId: USER }] },
      select: { id: true },
    });
    expect(prisma.areaInterest.upsert).toHaveBeenCalledWith({
      where: { userId_areaId: { userId: USER, areaId: AREA } },
      create: { userId: USER, areaId: AREA, rating: 5 },
      update: { rating: 5 },
      select: { areaId: true, rating: true },
    });
  });

  it('set on inaccessible or missing area gives NotFound and no upsert', async () => {
    const { service, prisma } = setup();
    prisma.area.findFirst.mockResolvedValue(null);
    await expect(service.set(USER, AREA, 3)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.areaInterest.upsert).not.toHaveBeenCalled();
  });

  it('remove only deletes the caller row and is idempotent', async () => {
    const { service, prisma } = setup();
    prisma.areaInterest.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.remove(USER, AREA)).resolves.toBeUndefined();
    expect(prisma.areaInterest.deleteMany).toHaveBeenCalledWith({
      where: { userId: USER, areaId: AREA },
    });
  });
});
