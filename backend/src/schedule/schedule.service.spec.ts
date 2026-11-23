import { BadRequestException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ScheduleService } from './schedule.service';
import { EctsWorkloadQueryDto } from './dto/ects-workload-query.dto';
import { ECTS_MAX_RANGE_DAYS } from './ects-workload.util';

const USER_ID = 'user-1';
const PERIOD_ID = '11111111-1111-4111-8111-111111111111';
const PAST_FROM = '2020-01-01';
const PAST_TO = '2020-01-31';
// 2026-07-15 12:00 Lisboa (UTC+1 no verao) = 11:00 UTC; nowMinutes = 720.
const NOW = new Date('2026-07-15T11:00:00Z');
const NOW_MINUTES = 720;
const TODAY_DATE = new Date('2026-07-15T00:00:00.000Z');

interface FindArgs {
  where: Record<string, unknown> & { date: { lte: Date; gte: Date } };
}

/** `where` da primeira chamada de um mock do Prisma, sem `any`. */
const firstWhere = (fn: jest.Mock): FindArgs['where'] =>
  (fn.mock.calls as FindArgs[][])[0][0].where;

const area = (id: string, name: string, credits = 6) => ({
  id,
  name,
  credits,
});

describe('ScheduleService.ectsWorkload', () => {
  const prisma = {
    classOccurrence: { findMany: jest.fn() },
    studySession: { findMany: jest.fn() },
    areaScheduleLink: { findMany: jest.fn() },
    area: { findMany: jest.fn() },
    areaHidden: { findMany: jest.fn() },
    task: { findMany: jest.fn() },
    academicPeriod: { findFirst: jest.fn() },
  };
  const service = new ScheduleService(prisma as never, {} as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.classOccurrence.findMany.mockResolvedValue([]);
    prisma.studySession.findMany.mockResolvedValue([]);
    prisma.areaScheduleLink.findMany.mockResolvedValue([]);
    prisma.area.findMany.mockResolvedValue([]);
    prisma.areaHidden.findMany.mockResolvedValue([]);
    prisma.task.findMany.mockResolvedValue([]);
    prisma.academicPeriod.findFirst.mockResolvedValue({ id: PERIOD_ID });
  });

  afterEach(() => jest.useRealTimers());

  it('scopes every query by userId and requires credits', async () => {
    await service.ectsWorkload(USER_ID, PAST_FROM, PAST_TO);

    expect(firstWhere(prisma.classOccurrence.findMany)).toEqual(
      expect.objectContaining({ userId: USER_ID, cancelled: false }),
    );
    expect(firstWhere(prisma.studySession.findMany)).toEqual(
      expect.objectContaining({ userId: USER_ID }),
    );
    expect(firstWhere(prisma.areaScheduleLink.findMany)).toEqual({
      userId: USER_ID,
    });
    expect(firstWhere(prisma.areaHidden.findMany)).toEqual({
      userId: USER_ID,
    });
    const areaWhere = JSON.stringify(firstWhere(prisma.area.findMany));
    expect(areaWhere).toContain(USER_ID);
    expect(areaWhere).toContain('"credits":{"gt":0}');
    expect(prisma.task.findMany).not.toHaveBeenCalled();
  });

  it('returns empty and skips queries when the clamped range is empty', async () => {
    const result = await service.ectsWorkload(
      USER_ID,
      '2999-01-01',
      '2999-01-31',
    );
    expect(result).toEqual({ courses: [], unlinkedSubjects: [] });
    expect(prisma.classOccurrence.findMany).not.toHaveBeenCalled();
  });

  it('clamps a future `to` to today (Lisbon)', async () => {
    jest.useFakeTimers().setSystemTime(NOW);
    await service.ectsWorkload(USER_ID, '2026-07-01', '2026-12-31');

    const where = firstWhere(prisma.classOccurrence.findMany);
    expect(where.date.lte).toEqual(TODAY_DATE);
    expect(where.date.gte).toEqual(new Date('2026-07-01T00:00:00.000Z'));
  });

  it('returns empty when from is after the clamped to', async () => {
    jest.useFakeTimers().setSystemTime(NOW);
    const result = await service.ectsWorkload(
      USER_ID,
      '2026-07-20',
      '2026-12-31',
    );
    expect(result).toEqual({ courses: [], unlinkedSubjects: [] });
    expect(prisma.classOccurrence.findMany).not.toHaveBeenCalled();
    expect(prisma.area.findMany).not.toHaveBeenCalled();
  });

  it('rejects a range longer than the cap with 400', async () => {
    await expect(
      service.ectsWorkload(USER_ID, '2020-01-01', '2021-12-31'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.classOccurrence.findMany).not.toHaveBeenCalled();
  });

  it('accepts a range of exactly the cap', async () => {
    // 2020-01-01 + 399 dias = 2021-02-03 (inclusivo: 400 dias).
    expect(ECTS_MAX_RANGE_DAYS).toBe(400);
    await expect(
      service.ectsWorkload(USER_ID, '2020-01-01', '2021-02-03'),
    ).resolves.toBeDefined();
    await expect(
      service.ectsWorkload(USER_ID, '2020-01-01', '2021-02-04'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects impossible calendar dates with 400 instead of a 500', async () => {
    await expect(
      service.ectsWorkload(USER_ID, '2026-02-31', '2026-03-01'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.classOccurrence.findMany).not.toHaveBeenCalled();
  });

  it('counts only classes already finished today, whole earlier days', async () => {
    jest.useFakeTimers().setSystemTime(NOW);
    prisma.areaScheduleLink.findMany.mockResolvedValue([
      { scheduleSubject: 'ALG', areaId: 'a' },
    ]);
    prisma.area.findMany.mockResolvedValue([area('a', 'Algebra')]);
    prisma.classOccurrence.findMany.mockResolvedValue([
      // ontem, acabou depois da hora atual: conta (e outro dia)
      row('2026-07-14', 'ALG', 900, 960),
      // hoje, ja acabou (11:00-12:00, agora 12:00): conta
      row('2026-07-15', 'ALG', 660, NOW_MINUTES),
      // hoje, ainda a decorrer / futura: nao conta
      row('2026-07-15', 'ALG', 700, 780),
      row('2026-07-15', 'ALG', 900, 1020),
    ]);

    const result = await service.ectsWorkload(
      USER_ID,
      '2026-07-01',
      '2026-07-15',
    );
    expect(result.courses[0].classMinutes).toBe(60 + 60);
  });

  describe('which courses are returned', () => {
    beforeEach(() => {
      prisma.areaScheduleLink.findMany.mockResolvedValue([
        { scheduleSubject: 'ALG', areaId: 'a' },
        { scheduleSubject: 'BIO', areaId: 'b' },
      ]);
      prisma.area.findMany.mockResolvedValue([
        area('a', 'Algebra'),
        area('b', 'Biology', 3),
        area('c', 'Catalog only'),
      ]);
    });

    it('without periodId keeps linked or studied courses, drops the rest', async () => {
      prisma.studySession.findMany.mockResolvedValue([
        {
          areaId: 'c',
          startedAt: new Date('2020-01-10T10:00:00Z'),
          endedAt: new Date('2020-01-10T11:00:00Z'),
        },
      ]);
      const result = await service.ectsWorkload(USER_ID, PAST_FROM, PAST_TO);
      expect(result.courses.map((c) => c.areaId)).toEqual(['a', 'b', 'c']);

      prisma.studySession.findMany.mockResolvedValue([]);
      const noStudy = await service.ectsWorkload(USER_ID, PAST_FROM, PAST_TO);
      expect(noStudy.courses.map((c) => c.areaId)).toEqual(['a', 'b']);
    });

    it('excludes areas the user hid', async () => {
      prisma.areaHidden.findMany.mockResolvedValue([{ areaId: 'a' }]);
      const result = await service.ectsWorkload(USER_ID, PAST_FROM, PAST_TO);
      expect(result.courses.map((c) => c.areaId)).toEqual(['b']);
    });

    it('with periodId keeps only areas with a task in that period', async () => {
      prisma.task.findMany.mockResolvedValue([{ areaId: 'b' }]);
      const result = await service.ectsWorkload(
        USER_ID,
        PAST_FROM,
        PAST_TO,
        PERIOD_ID,
      );
      expect(result.courses.map((c) => c.areaId)).toEqual(['b']);
      expect(firstWhere(prisma.task.findMany)).toEqual({
        userId: USER_ID,
        periodId: PERIOD_ID,
      });
    });

    it('with periodId still drops hidden areas', async () => {
      prisma.task.findMany.mockResolvedValue([
        { areaId: 'a' },
        { areaId: 'b' },
      ]);
      prisma.areaHidden.findMany.mockResolvedValue([{ areaId: 'b' }]);
      const result = await service.ectsWorkload(
        USER_ID,
        PAST_FROM,
        PAST_TO,
        PERIOD_ID,
      );
      expect(result.courses.map((c) => c.areaId)).toEqual(['a']);
    });

    it('404s on a period that is not the user own', async () => {
      prisma.academicPeriod.findFirst.mockResolvedValue(null);
      await expect(
        service.ectsWorkload(USER_ID, PAST_FROM, PAST_TO, PERIOD_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(firstWhere(prisma.academicPeriod.findFirst)).toEqual({
        id: PERIOD_ID,
        program: { userId: USER_ID },
      });
      expect(prisma.classOccurrence.findMany).not.toHaveBeenCalled();
    });
  });
});

function row(dateKey: string, subject: string, start: number, end: number) {
  return {
    date: new Date(`${dateKey}T00:00:00.000Z`),
    subject,
    startMinutes: start,
    endMinutes: end,
    cancelled: false,
    attended: null,
  };
}

describe('EctsWorkloadQueryDto', () => {
  const check = (plain: Record<string, unknown>) =>
    validate(plainToInstance(EctsWorkloadQueryDto, plain));

  it('accepts real dates and an optional uuid periodId', async () => {
    expect(await check({ from: '2026-02-28', to: '2026-03-01' })).toHaveLength(
      0,
    );
    expect(
      await check({
        from: '2028-02-29',
        to: '2028-03-01',
        periodId: PERIOD_ID,
      }),
    ).toHaveLength(0);
  });

  it.each([
    ['2026-13-01', '2026-12-01'],
    ['2026-02-31', '2026-03-01'],
    ['2026-02-29', '2026-03-01'],
    ['2026-00-10', '2026-03-01'],
    ['2026-1-01', '2026-03-01'],
    ['2026-01-01', 'not-a-date'],
  ])('rejects %s / %s', async (from, to) => {
    const errors = await check({ from, to });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a non-uuid periodId', async () => {
    const errors = await check({
      from: '2026-01-01',
      to: '2026-01-02',
      periodId: 'nope',
    });
    expect(errors.map((e) => e.property)).toEqual(['periodId']);
  });
});

describe('ScheduleService today cut (attendance, study-vs-class)', () => {
  const prisma = {
    classOccurrence: { groupBy: jest.fn(), findMany: jest.fn() },
    studySession: { findMany: jest.fn() },
    areaScheduleLink: { findMany: jest.fn() },
    area: { findMany: jest.fn() },
  };
  const service = new ScheduleService(prisma as never, {} as never);
  const FROM = new Date('2026-07-01T00:00:00.000Z');
  const END_OF_TODAY = new Date('2026-07-15T23:59:59.999Z');

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now: NOW });
    prisma.classOccurrence.groupBy.mockResolvedValue([]);
    prisma.classOccurrence.findMany.mockResolvedValue([]);
    prisma.studySession.findMany.mockResolvedValue([]);
    prisma.areaScheduleLink.findMany.mockResolvedValue([]);
    prisma.area.findMany.mockResolvedValue([]);
  });
  afterEach(() => jest.useRealTimers());

  it('cuts attendance at the end of today', async () => {
    await service.attendanceSummary(
      USER_ID,
      FROM,
      new Date('2026-12-31T00:00:00.000Z'),
    );
    const where = firstWhere(prisma.classOccurrence.groupBy);
    expect(where.userId).toBe(USER_ID);
    expect(where.date.lte).toEqual(END_OF_TODAY);
  });

  it('keeps a past end date as the end of that day', async () => {
    await service.studyVsClass(
      USER_ID,
      FROM,
      new Date('2026-07-10T00:00:00.000Z'),
    );
    const where = firstWhere(prisma.classOccurrence.findMany);
    expect(where.date.lte).toEqual(new Date('2026-07-10T23:59:59.999Z'));
  });

  it('cuts study-vs-class at the end of today', async () => {
    await service.studyVsClass(
      USER_ID,
      FROM,
      new Date('2026-12-31T00:00:00.000Z'),
    );
    expect(firstWhere(prisma.classOccurrence.findMany).date.lte).toEqual(
      END_OF_TODAY,
    );
  });
});

describe('ScheduleService manual classes', () => {
  const OTHER_ID = '22222222-2222-4222-8222-222222222222';
  const prisma = {
    classOccurrence: {
      create: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
  const service = new ScheduleService(prisma as never, {} as never);
  const BASE = {
    date: '2026-09-14',
    startMinutes: 540,
    endMinutes: 600,
    subject: ' Maths ',
  };

  beforeEach(() => jest.clearAllMocks());

  it('creates a class for the user with a manual uid', async () => {
    prisma.classOccurrence.create.mockResolvedValue({ id: 'c1' });
    await service.createClass(USER_ID, BASE);
    const data = (
      prisma.classOccurrence.create.mock.calls as {
        data: Record<string, unknown>;
      }[][]
    )[0][0].data;
    expect(data.userId).toBe(USER_ID);
    expect(data.subject).toBe('Maths');
    expect(String(data.externalUid).startsWith('manual-')).toBe(true);
  });

  it('rejects start after end on create', async () => {
    await expect(
      service.createClass(USER_ID, { ...BASE, startMinutes: 700 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('404s when updating a class of another user', async () => {
    prisma.classOccurrence.findFirst.mockResolvedValue(null);
    await expect(
      service.updateClass(USER_ID, OTHER_ID, { subject: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.classOccurrence.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: OTHER_ID, userId: USER_ID } }),
    );
    expect(prisma.classOccurrence.updateMany).not.toHaveBeenCalled();
  });

  it('validates the merged time range on update', async () => {
    prisma.classOccurrence.findFirst.mockResolvedValue({
      startMinutes: 540,
      endMinutes: 600,
    });
    await expect(
      service.updateClass(USER_ID, OTHER_ID, { startMinutes: 650 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('scopes update and delete by userId', async () => {
    prisma.classOccurrence.findFirst.mockResolvedValue({
      startMinutes: 540,
      endMinutes: 600,
    });
    prisma.classOccurrence.updateMany.mockResolvedValue({ count: 1 });
    await service.updateClass(USER_ID, OTHER_ID, { location: '' });
    expect(prisma.classOccurrence.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: OTHER_ID, userId: USER_ID },
        data: expect.objectContaining({ location: null }) as unknown,
      }),
    );
    prisma.classOccurrence.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.deleteClass(USER_ID, OTHER_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.classOccurrence.deleteMany).toHaveBeenCalledWith({
      where: { id: OTHER_ID, userId: USER_ID },
    });
  });
});
