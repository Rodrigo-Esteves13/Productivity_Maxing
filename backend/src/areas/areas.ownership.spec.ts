// Ownership em AreasService: listagem so mostra oficiais + privadas do user,
// "em uso" e "usada no periodo" sao sempre do proprio user, e o clash
// concorrente de nome oficial (P2002) vira 409. Prisma mockado.
import { ConflictException } from '@nestjs/common';
import { AreasService } from './areas.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { CreateAreaDto } from './dto/create-area.dto';

function area(id: string, ownerId: string | null) {
  return {
    id,
    name: `Area ${id}`,
    colorHex: '#000000',
    ownerId,
    proposalStatus: 'NONE',
    defaultTaskType: null,
    defaultTaskTypeId: null,
  };
}

function setup(areas: ReturnType<typeof area>[] = []) {
  const prisma = {
    area: {
      findMany: jest.fn().mockResolvedValue(areas),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
    },
    areaHidden: { findMany: jest.fn().mockResolvedValue([]) },
    task: { findMany: jest.fn().mockResolvedValue([]) },
    notebookEntry: { findMany: jest.fn().mockResolvedValue([]) },
    taskType: { findUnique: jest.fn().mockResolvedValue(null) },
  };
  const service = new AreasService(prisma as unknown as PrismaService);
  return { prisma, service };
}

type Where = { where: Record<string, unknown> };
const whereOf = (mock: jest.Mock, call = 0) =>
  (mock.mock.calls[call] as [Where])[0].where;

describe('AreasService.findAll ownership', () => {
  it('queries official OR own areas, and hidden rows of the caller only', async () => {
    const { prisma, service } = setup();
    await service.findAll('u1');
    expect(whereOf(prisma.area.findMany)).toEqual({
      OR: [{ ownerId: null }, { ownerId: 'u1' }],
    });
    expect(whereOf(prisma.areaHidden.findMany)).toEqual({ userId: 'u1' });
  });

  it('hidden-but-in-use lookups are scoped by userId', async () => {
    const { prisma, service } = setup([area('a1', null), area('a2', null)]);
    prisma.areaHidden.findMany.mockResolvedValue([{ areaId: 'a1' }]);
    prisma.task.findMany.mockResolvedValue([{ areaId: 'a1' }]);

    const result = await service.findAll('u1');

    expect(whereOf(prisma.task.findMany)).toMatchObject({ userId: 'u1' });
    expect(whereOf(prisma.notebookEntry.findMany)).toMatchObject({
      userId: 'u1',
    });
    // a1 esta escondida mas em uso: continua visivel.
    expect(result.map((a) => a.id)).toEqual(['a1', 'a2']);
  });

  it('a hidden area not in use disappears, unless includeHidden', async () => {
    const { prisma, service } = setup([area('a1', null)]);
    prisma.areaHidden.findMany.mockResolvedValue([{ areaId: 'a1' }]);
    expect(await service.findAll('u1')).toEqual([]);
    const all = await service.findAll('u1', undefined, true);
    expect(all).toHaveLength(1);
    expect(all[0].isHidden).toBe(true);
  });

  it('includeHidden skips the in-use lookups entirely', async () => {
    const { prisma, service } = setup([area('a1', null)]);
    prisma.areaHidden.findMany.mockResolvedValue([{ areaId: 'a1' }]);
    await service.findAll('u1', undefined, true);
    expect(prisma.task.findMany).not.toHaveBeenCalled();
    expect(prisma.notebookEntry.findMany).not.toHaveBeenCalled();
  });

  it('periodId "all", empty and missing do not query tasks for usedInPeriod', async () => {
    const { prisma, service } = setup([area('a1', null)]);
    await service.findAll('u1', 'all');
    await service.findAll('u1', '');
    await service.findAll('u1', undefined);
    expect(prisma.task.findMany).not.toHaveBeenCalled();
  });

  it('usedInPeriod reads only tasks of the caller in that period', async () => {
    const { prisma, service } = setup([area('a1', null), area('a2', 'u1')]);
    prisma.task.findMany.mockResolvedValue([{ areaId: 'a2' }]);

    const result = (await service.findAll('u1', 'p9')) as {
      id: string;
      usedInPeriod?: boolean;
    }[];

    expect(whereOf(prisma.task.findMany)).toEqual({
      userId: 'u1',
      periodId: 'p9',
    });
    expect(result.find((a) => a.id === 'a1')?.usedInPeriod).toBe(false);
    expect(result.find((a) => a.id === 'a2')?.usedInPeriod).toBe(true);
  });
});

describe('AreasService.findOne ownership', () => {
  it('another user private area is not found (same as a missing one)', async () => {
    const { prisma, service } = setup();
    expect(await service.findOne('u1', 'foreign')).toBeNull();
    expect(whereOf(prisma.area.findFirst)).toEqual({
      id: 'foreign',
      OR: [{ ownerId: null }, { ownerId: 'u1' }],
    });
  });
});

describe('AreasService.createOfficial concurrent name clash', () => {
  const dto = { name: ' Redes ' } as CreateAreaDto;

  it('maps a P2002 from the unique index to 409', async () => {
    const { prisma, service } = setup();
    prisma.area.create.mockRejectedValue({ code: 'P2002' });
    await expect(service.createOfficial('admin', dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rethrows other errors untouched', async () => {
    const { prisma, service } = setup();
    const boom = new Error('db down');
    prisma.area.create.mockRejectedValue(boom);
    await expect(service.createOfficial('admin', dto)).rejects.toBe(boom);
  });

  it('the pre-check only looks at official areas (ownerId null)', async () => {
    const { prisma, service } = setup();
    prisma.area.create.mockResolvedValue(area('new', null));
    await service.createOfficial('admin', dto);
    expect(whereOf(prisma.area.findFirst)).toMatchObject({
      ownerId: null,
      name: { equals: 'Redes', mode: 'insensitive' },
    });
  });
});
