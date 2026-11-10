import 'reflect-metadata';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { PrismaService } from '../prisma/prisma.service';
import { isoWeekRange, StreakFreezesService } from './streak-freezes.service';
import { CreateStreakFreezeDto } from './dto/create-streak-freeze.dto';
import { FREEZE_MAX_PER_WEEK } from './streak-freeze.constants';

const USER = 'user-1';
const ID = '11111111-1111-4111-8111-111111111111';
// Novembro: Lisboa = UTC. Hoje = terca 2026-11-10 (semana 09..15).
const NOW = new Date('2026-11-10T15:00:00.000Z');
const TODAY = '2026-11-10';
const YESTERDAY = '2026-11-09';

interface Opts {
  existing?: { id: string; dateKey: string; createdAt: Date } | null;
  weekCount?: number[];
  activity?: boolean;
  rows?: { id: string; dateKey: string; createdAt: Date }[];
  owned?: { id: string; dateKey: string } | null;
}

function build(opts: Opts = {}) {
  const counts = [...(opts.weekCount ?? [0, 1])];
  const prisma = {
    streakFreeze: {
      findUnique: jest.fn().mockResolvedValue(opts.existing ?? null),
      findFirst: jest.fn().mockResolvedValue(opts.owned ?? null),
      findMany: jest.fn().mockResolvedValue(opts.rows ?? []),
      count: jest.fn(() => Promise.resolve(counts.shift() ?? 0)),
      create: jest.fn((args: { data: { userId: string; dateKey: string } }) =>
        Promise.resolve({
          id: ID,
          dateKey: args.data.dateKey,
          createdAt: NOW,
        }),
      ),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    studySession: {
      findFirst: jest
        .fn()
        .mockResolvedValue(opts.activity ? { id: 's1' } : null),
    },
  };
  return {
    prisma,
    service: new StreakFreezesService(prisma as unknown as PrismaService),
  };
}

describe('StreakFreezesService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });
  afterEach(() => jest.useRealTimers());

  it('isoWeekRange goes from Monday to Sunday', () => {
    expect(isoWeekRange(TODAY)).toEqual({
      from: '2026-11-09',
      to: '2026-11-15',
    });
    expect(isoWeekRange('2026-11-15')).toEqual({
      from: '2026-11-09',
      to: '2026-11-15',
    });
    expect(isoWeekRange('2026-11-16').from).toBe('2026-11-16');
  });

  it('creates a rest day for today by default, scoped to the user', async () => {
    const { service, prisma } = build();
    const row = await service.create(USER);
    expect(row.dateKey).toBe(TODAY);
    expect(prisma.streakFreeze.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { userId: USER, dateKey: TODAY } }),
    );
    expect(prisma.studySession.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: USER }) as unknown,
      }),
    );
  });

  it('accepts yesterday', async () => {
    const { service } = build();
    expect((await service.create(USER, YESTERDAY)).dateKey).toBe(YESTERDAY);
  });

  it('rejects days outside today/yesterday and impossible dates', async () => {
    const { service, prisma } = build();
    await expect(service.create(USER, '2026-11-08')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.create(USER, '2026-11-11')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.create(USER, '2026-13-45')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.streakFreeze.create).not.toHaveBeenCalled();
  });

  it('is idempotent for the same day', async () => {
    const existing = { id: ID, dateKey: TODAY, createdAt: NOW };
    const { service, prisma } = build({ existing });
    expect(await service.create(USER, TODAY)).toBe(existing);
    expect(prisma.streakFreeze.create).not.toHaveBeenCalled();
  });

  it('refuses a day that already has a study session', async () => {
    const { service, prisma } = build({ activity: true });
    await expect(service.create(USER)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.streakFreeze.create).not.toHaveBeenCalled();
  });

  it('enforces the weekly cap', async () => {
    const { service, prisma } = build({ weekCount: [FREEZE_MAX_PER_WEEK] });
    await expect(service.create(USER)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.streakFreeze.create).not.toHaveBeenCalled();
    const [countArgs] = prisma.streakFreeze.count.mock.calls[0] as unknown as [
      { where: { userId: string; dateKey: { gte: string; lte: string } } },
    ];
    expect(countArgs.where).toEqual({
      userId: USER,
      dateKey: { gte: '2026-11-09', lte: '2026-11-15' },
    });
  });

  it('undoes a create that raced past the weekly cap', async () => {
    const { service, prisma } = build({
      weekCount: [0, FREEZE_MAX_PER_WEEK + 1],
    });
    await expect(service.create(USER)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.streakFreeze.deleteMany).toHaveBeenCalledWith({
      where: { id: ID, userId: USER },
    });
  });

  it('status reports today and the weekly usage', async () => {
    const { service, prisma } = build({
      rows: [{ id: ID, dateKey: TODAY, createdAt: NOW }],
    });
    const status = await service.status(USER);
    expect(status).toMatchObject({
      todayKey: TODAY,
      todayFreezeId: ID,
      usedThisWeek: 1,
      maxPerWeek: FREEZE_MAX_PER_WEEK,
      canFreezeToday: false,
    });
    const [args] = prisma.streakFreeze.findMany.mock.calls[0] as [
      { where: { userId: string } },
    ];
    expect(args.where.userId).toBe(USER);
  });

  it('status allows a rest day when nothing blocks it', async () => {
    const { service } = build();
    expect((await service.status(USER)).canFreezeToday).toBe(true);
  });

  it('status blocks a rest day when there is activity today', async () => {
    const { service } = build({ activity: true });
    expect((await service.status(USER)).canFreezeToday).toBe(false);
  });

  it('remove only finds the user own rest day', async () => {
    const { service, prisma } = build({ owned: null });
    await expect(service.remove(USER, ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.streakFreeze.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: ID, userId: USER } }),
    );
    expect(prisma.streakFreeze.deleteMany).not.toHaveBeenCalled();
  });

  it('remove refuses a past rest day', async () => {
    const { service, prisma } = build({
      owned: { id: ID, dateKey: YESTERDAY },
    });
    await expect(service.remove(USER, ID)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.streakFreeze.deleteMany).not.toHaveBeenCalled();
  });

  it("remove deletes today's rest day", async () => {
    const { service, prisma } = build({ owned: { id: ID, dateKey: TODAY } });
    await service.remove(USER, ID);
    expect(prisma.streakFreeze.deleteMany).toHaveBeenCalledWith({
      where: { id: ID, userId: USER },
    });
  });

  it('DTO validates the date key format', async () => {
    const bad = await validate(
      plainToInstance(CreateStreakFreezeDto, { dateKey: '10/11/2026' }),
    );
    expect(bad).toHaveLength(1);
    const ok = await validate(plainToInstance(CreateStreakFreezeDto, {}));
    expect(ok).toHaveLength(0);
  });
});
