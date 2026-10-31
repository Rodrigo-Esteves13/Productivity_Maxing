import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AreaRatingsService } from './area-ratings.service';
import { SetAreaRatingDto } from './dto/set-area-rating.dto';
import { RATING_MAX, RATING_MIN } from './area-ratings.constants';
import type { PrismaService } from '../prisma/prisma.service';

const USER = 'user-1';
const AREA = 'area-1';

function build(overrides: Record<string, unknown> = {}) {
  const prisma = {
    area: { findFirst: jest.fn().mockResolvedValue({ id: AREA }) },
    areaRating: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockImplementation(
        (args: {
          create: {
            teacherRating: number | null;
            courseLiking: number | null;
          };
        }) =>
          Promise.resolve({
            areaId: AREA,
            teacherRating: args.create.teacherRating,
            courseLiking: args.create.courseLiking,
          }),
      ),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    ...overrides,
  };
  return {
    prisma,
    service: new AreaRatingsService(prisma as unknown as PrismaService),
  };
}

describe('AreaRatingsService ownership', () => {
  it('list only reads the caller rows', async () => {
    const { prisma, service } = build();
    await service.list(USER);
    expect(prisma.areaRating.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER } }),
    );
  });

  it('set checks area access for the caller and keys the upsert by user', async () => {
    const { prisma, service } = build();
    await service.set(USER, AREA, { teacherRating: 4 });
    expect(prisma.area.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: AREA, OR: [{ ownerId: null }, { ownerId: USER }] },
      }),
    );
    expect(prisma.areaRating.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_areaId: { userId: USER, areaId: AREA } },
        create: {
          userId: USER,
          areaId: AREA,
          teacherRating: 4,
          courseLiking: null,
        },
        update: { teacherRating: 4 },
      }),
    );
    expect(prisma.areaRating.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: USER,
        areaId: AREA,
        teacherRating: null,
        courseLiking: null,
      },
    });
  });

  it('set returns 404 for another user private area and writes nothing', async () => {
    const { prisma, service } = build({
      area: { findFirst: jest.fn().mockResolvedValue(null) },
    });
    await expect(
      service.set(USER, AREA, { courseLiking: 5 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.areaRating.upsert).not.toHaveBeenCalled();
    expect(prisma.areaRating.deleteMany).not.toHaveBeenCalled();
  });

  it('remove only deletes the caller row', async () => {
    const { prisma, service } = build();
    await service.remove(USER, AREA);
    expect(prisma.areaRating.deleteMany).toHaveBeenCalledWith({
      where: { userId: USER, areaId: AREA },
    });
  });
});

describe('AreaRatingsService partial upsert', () => {
  it('writes only the sent field and never reads first', async () => {
    const { prisma, service } = build();
    await service.set(USER, AREA, { teacherRating: 3 });
    const [args] = prisma.areaRating.upsert.mock.calls[0] as [
      { update: Record<string, unknown> },
    ];
    expect(args.update).toEqual({ teacherRating: 3 });
    expect(args.update).not.toHaveProperty('courseLiking');
    expect(prisma.areaRating.findUnique).not.toHaveBeenCalled();
  });

  it('null is sent as null (clears only that field)', async () => {
    const { prisma, service } = build();
    await service.set(USER, AREA, { courseLiking: null });
    expect(prisma.areaRating.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { courseLiking: null } }),
    );
  });

  it('cleanup only targets rows with both fields null', async () => {
    const { prisma, service } = build();
    await service.set(USER, AREA, { teacherRating: null, courseLiking: null });
    expect(prisma.areaRating.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: USER,
        areaId: AREA,
        teacherRating: null,
        courseLiking: null,
      },
    });
  });
});

describe('AreaRatingsService concurrent partial PUTs', () => {
  interface Row {
    teacherRating: number | null;
    courseLiking: number | null;
  }

  /** Armazem em memoria; upsert e deleteMany sao atomicos por linha, como na BD. */
  function buildStore() {
    let row: Row | null = null;
    const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
    const areaRating = {
      upsert: jest.fn(async (args: { create: Row; update: Partial<Row> }) => {
        await tick();
        row = row
          ? { ...row, ...args.update }
          : {
              teacherRating: args.create.teacherRating,
              courseLiking: args.create.courseLiking,
            };
        return { areaId: AREA, ...row };
      }),
      deleteMany: jest.fn(async () => {
        await tick();
        if (row && row.teacherRating === null && row.courseLiking === null) {
          row = null;
        }
        return { count: 0 };
      }),
    };
    const prisma = {
      area: { findFirst: jest.fn().mockResolvedValue({ id: AREA }) },
      areaRating,
    };
    return {
      get row() {
        return row;
      },
      service: new AreaRatingsService(prisma as unknown as PrismaService),
    };
  }

  it('two quick PUTs on different fields keep both values', async () => {
    const store = buildStore();
    await Promise.all([
      store.service.set(USER, AREA, { teacherRating: 4 }),
      store.service.set(USER, AREA, { courseLiking: 5 }),
    ]);
    expect(store.row).toEqual({ teacherRating: 4, courseLiking: 5 });
  });

  it('a clear racing a set never deletes the row the set created', async () => {
    const store = buildStore();
    await Promise.all([
      store.service.set(USER, AREA, { courseLiking: null }),
      store.service.set(USER, AREA, { teacherRating: 4 }),
    ]);
    expect(store.row).toEqual({ teacherRating: 4, courseLiking: null });
  });

  it('clearing the last remaining field deletes the row', async () => {
    const store = buildStore();
    await store.service.set(USER, AREA, { teacherRating: 4 });
    const result = await store.service.set(USER, AREA, { teacherRating: null });
    expect(store.row).toBeNull();
    expect(result).toEqual({
      areaId: AREA,
      teacherRating: null,
      courseLiking: null,
    });
  });
});

describe('SetAreaRatingDto', () => {
  const check = (body: Record<string, unknown>) =>
    validate(plainToInstance(SetAreaRatingDto, body));

  it('accepts integers in range and null', async () => {
    expect(await check({ teacherRating: RATING_MIN })).toHaveLength(0);
    expect(await check({ courseLiking: RATING_MAX })).toHaveLength(0);
    expect(await check({ teacherRating: 3, courseLiking: null })).toHaveLength(
      0,
    );
    expect(
      await check({ teacherRating: null, courseLiking: null }),
    ).toHaveLength(0);
  });

  it('rejects out of range, decimals and non-numbers', async () => {
    expect(await check({ teacherRating: RATING_MIN - 1 })).not.toHaveLength(0);
    expect(await check({ courseLiking: RATING_MAX + 1 })).not.toHaveLength(0);
    expect(await check({ teacherRating: 3.5 })).not.toHaveLength(0);
    expect(await check({ courseLiking: '4' })).not.toHaveLength(0);
  });

  it('requires at least one of the two fields', async () => {
    expect(await check({})).not.toHaveLength(0);
  });

  it('rejects unknown fields under the global whitelist', async () => {
    const errors = await validate(
      plainToInstance(SetAreaRatingDto, { teacherRating: 4, userId: 'x' }),
      { whitelist: true, forbidNonWhitelisted: true },
    );
    expect(errors.map((e) => e.property)).toEqual(['userId']);
  });
});
