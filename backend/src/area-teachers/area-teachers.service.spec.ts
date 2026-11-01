import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AreaTeachersService } from './area-teachers.service';
import { SetAreaTeacherDto } from './dto/set-area-teacher.dto';
import { TEACHER_NAME_MAX_LENGTH, teacherKey } from './area-teachers.constants';
import type { PrismaService } from '../prisma/prisma.service';

const USER = 'user-1';
const AREA = 'area-1';

function build(overrides: Record<string, unknown> = {}) {
  const prisma = {
    area: { findFirst: jest.fn().mockResolvedValue({ id: AREA }) },
    areaTeacherNote: {
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockResolvedValue({ areaId: AREA, teacherName: 'X' }),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    areaScheduleLink: { findMany: jest.fn().mockResolvedValue([]) },
    classOccurrence: { groupBy: jest.fn().mockResolvedValue([]) },
    $transaction: jest
      .fn()
      .mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
    task: { findMany: jest.fn().mockResolvedValue([]) },
    gradeComponent: { findMany: jest.fn().mockResolvedValue([]) },
    academicPeriod: {
      findMany: jest
        .fn()
        .mockResolvedValue([{ id: 'p1', program: { gradeScale: '0-20' } }]),
    },
    ...overrides,
  };
  return {
    prisma,
    service: new AreaTeachersService(prisma as unknown as PrismaService),
  };
}

describe('AreaTeachersService ownership', () => {
  it('list only reads the caller rows', async () => {
    const { prisma, service } = build();
    await service.list(USER);
    expect(prisma.areaTeacherNote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER } }),
    );
  });

  it('set checks area access for the caller and keys the upsert by user', async () => {
    const { prisma, service } = build();
    await service.set(USER, AREA, 'Maria');
    expect(prisma.area.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: AREA, OR: [{ ownerId: null }, { ownerId: USER }] },
      }),
    );
    expect(prisma.areaTeacherNote.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_areaId: { userId: USER, areaId: AREA } },
      }),
    );
  });

  it('set returns 404 for another user private area and writes nothing', async () => {
    const { prisma, service } = build({
      area: { findFirst: jest.fn().mockResolvedValue(null) },
    });
    await expect(service.set(USER, AREA, 'Maria')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.areaTeacherNote.upsert).not.toHaveBeenCalled();
  });

  it('remove only deletes the caller row', async () => {
    const { prisma, service } = build();
    await service.remove(USER, AREA);
    expect(prisma.areaTeacherNote.deleteMany).toHaveBeenCalledWith({
      where: { userId: USER, areaId: AREA },
    });
  });
});

describe('SetAreaTeacherDto', () => {
  const check = (teacherName: unknown) =>
    validate(plainToInstance(SetAreaTeacherDto, { teacherName }));

  it('trims and accepts a normal name', async () => {
    const dto = plainToInstance(SetAreaTeacherDto, { teacherName: '  Ana  ' });
    expect(dto.teacherName).toBe('Ana');
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects blank, too long and non-string values', async () => {
    expect(await check('   ')).not.toHaveLength(0);
    expect(
      await check('a'.repeat(TEACHER_NAME_MAX_LENGTH + 1)),
    ).not.toHaveLength(0);
    expect(await check(42)).not.toHaveLength(0);
  });
});

describe('teacherKey', () => {
  it('ignores case and surrounding or repeated spaces', () => {
    expect(teacherKey('  Maria   SILVA ')).toBe(teacherKey('maria silva'));
  });
});

describe('teacherStatsForUser', () => {
  const task = (areaId: string, realGrade: number) => ({
    realGrade,
    weightPercentage: 100,
    areaId,
    periodId: 'p1',
    title: `t-${areaId}-${realGrade}`,
    recurrenceFrequency: null,
  });

  it('compares each area with the OTHER areas of the same teacher (case-insensitive), on a 0-1 scale', async () => {
    const { service } = build({
      areaTeacherNote: {
        findMany: jest.fn().mockResolvedValue([
          { areaId: 'a', teacherName: 'Maria Silva' },
          { areaId: 'b', teacherName: ' maria silva ' },
        ]),
      },
      task: {
        findMany: jest
          .fn()
          .mockResolvedValue([task('a', 8), task('b', 12), task('c', 18)]),
      },
    });
    const stats = await service.teacherStatsForUser(USER);
    // Leave-one-out: a compara com b (0.6), b compara com a (0.4).
    expect(stats.get('a')).toEqual({
      name: 'Maria Silva',
      avgWithTeacher: 0.6,
      avgOthers: 0.9,
      sampleWithTeacher: 1,
    });
    expect(stats.get('b')).toEqual({
      name: 'Maria Silva',
      avgWithTeacher: 0.4,
      avgOthers: 0.9,
      sampleWithTeacher: 1,
    });
    expect(stats.has('c')).toBe(false);
  });

  it('never counts the scored course in its own with-teacher group', async () => {
    const { service } = build({
      areaTeacherNote: {
        findMany: jest.fn().mockResolvedValue([
          { areaId: 'a', teacherName: 'Rui' },
          { areaId: 'b', teacherName: 'Rui' },
          { areaId: 'c', teacherName: 'Rui' },
        ]),
      },
      task: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            task('a', 4),
            task('a', 6),
            task('b', 12),
            task('c', 16),
            task('d', 20),
          ]),
      },
    });
    const stats = await service.teacherStatsForUser(USER);
    // a: so b e c (0.6 e 0.8); as 2 notas de a ficam de fora.
    expect(stats.get('a')).toMatchObject({
      avgWithTeacher: 0.7,
      avgOthers: 1,
      sampleWithTeacher: 2,
    });
  });

  it('returns no stats when the scored course is the only one with that teacher', async () => {
    const { service } = build({
      areaTeacherNote: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ areaId: 'a', teacherName: 'Ana' }]),
      },
      task: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            task('a', 6),
            task('a', 7),
            task('a', 8),
            task('b', 18),
          ]),
      },
    });
    expect((await service.teacherStatsForUser(USER)).size).toBe(0);
  });

  it('skips areas with no comparison group', async () => {
    const { service } = build({
      areaTeacherNote: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ areaId: 'a', teacherName: 'Ana' }]),
      },
      task: { findMany: jest.fn().mockResolvedValue([task('a', 10)]) },
    });
    expect((await service.teacherStatsForUser(USER)).size).toBe(0);
  });

  it('returns empty without querying grades when the user has no notes', async () => {
    const { prisma, service } = build();
    expect((await service.teacherStatsForUser(USER)).size).toBe(0);
    expect(prisma.task.findMany).not.toHaveBeenCalled();
  });
});

describe('syncFromSchedule', () => {
  const link = { areaId: AREA, scheduleSubject: 'PC' };
  const occ = (professor: string | null, n: number, subject = 'PC') => ({
    subject,
    professor,
    _count: { _all: n },
  });

  function withSchedule(
    occurrences: ReturnType<typeof occ>[],
    notes: Record<string, unknown>[],
  ) {
    return build({
      areaScheduleLink: { findMany: jest.fn().mockResolvedValue([link]) },
      classOccurrence: { groupBy: jest.fn().mockResolvedValue(occurrences) },
      areaTeacherNote: {
        findMany: jest.fn().mockResolvedValue(notes),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    });
  }

  it('creates an auto note with the most frequent trimmed professor', async () => {
    const { prisma, service } = withSchedule(
      [occ(' Ana ', 2), occ('Ana', 1), occ('Rui', 2), occ('  ', 9)],
      [],
    );
    await service.syncFromSchedule(USER);
    expect(prisma.areaTeacherNote.createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: USER,
          areaId: AREA,
          teacherName: 'Ana',
          autoFromSchedule: true,
        },
      ],
      skipDuplicates: true,
    });
    expect(prisma.classOccurrence.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: USER,
          subject: { in: ['PC'] },
          professor: { not: null },
        },
      }),
    );
  });

  it('updates an auto note when the schedule teacher changed', async () => {
    const { prisma, service } = withSchedule(
      [occ('Rui', 3)],
      [{ areaId: AREA, teacherName: 'Ana', autoFromSchedule: true }],
    );
    await service.syncFromSchedule(USER);
    expect(prisma.areaTeacherNote.updateMany).toHaveBeenCalledWith({
      where: { userId: USER, areaId: AREA, autoFromSchedule: true },
      data: { teacherName: 'Rui' },
    });
    expect(prisma.areaTeacherNote.createMany).not.toHaveBeenCalled();
  });

  it('never overwrites a manual note', async () => {
    const { prisma, service } = withSchedule(
      [occ('Rui', 3)],
      [{ areaId: AREA, teacherName: 'Ana', autoFromSchedule: false }],
    );
    await service.syncFromSchedule(USER);
    expect(prisma.areaTeacherNote.updateMany).not.toHaveBeenCalled();
    expect(prisma.areaTeacherNote.createMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('removes a stale auto note and leaves manual notes alone', async () => {
    const { prisma, service } = withSchedule(
      [],
      [
        { areaId: 'gone', teacherName: 'Ana', autoFromSchedule: true },
        { areaId: 'manual', teacherName: 'Rui', autoFromSchedule: false },
      ],
    );
    await service.syncFromSchedule(USER);
    expect(prisma.areaTeacherNote.deleteMany).toHaveBeenCalledTimes(1);
    expect(prisma.areaTeacherNote.deleteMany).toHaveBeenCalledWith({
      where: { userId: USER, autoFromSchedule: true, areaId: { in: ['gone'] } },
    });
  });

  it('groups spellings by teacherKey and keeps the most frequent one', async () => {
    const { prisma, service } = withSchedule(
      [
        occ('ana silva', 1),
        occ('Ana Silva', 2),
        occ('ANA  SILVA', 1),
        occ('Rui', 3),
      ],
      [],
    );
    await service.syncFromSchedule(USER);
    expect(prisma.areaTeacherNote.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ teacherName: 'Ana Silva' })],
      }),
    );
  });

  it('breaks ties with a plain comparison', async () => {
    const { prisma, service } = withSchedule(
      [occ('Rui', 2), occ('Ana', 2)],
      [],
    );
    await service.syncFromSchedule(USER);
    expect(prisma.areaTeacherNote.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [expect.objectContaining({ teacherName: 'Ana' })],
      }),
    );
  });

  it('a failing sync does not break list or teacherStatsForUser', async () => {
    const { prisma, service } = build({
      areaScheduleLink: {
        findMany: jest.fn().mockRejectedValue(new Error('secret db detail')),
      },
    });
    const warn = jest
      .spyOn(
        (service as unknown as { logger: { warn: () => void } }).logger,
        'warn',
      )
      .mockImplementation(() => undefined);
    await expect(service.list(USER)).resolves.toEqual([]);
    await expect(service.teacherStatsForUser(USER)).resolves.toEqual(new Map());
    expect(prisma.areaTeacherNote.findMany).toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(2);
    for (const call of warn.mock.calls as unknown[][])
      expect(JSON.stringify(call)).not.toContain('secret');
  });

  it('set marks the note as manual', async () => {
    const { prisma, service } = build();
    await service.set(USER, AREA, 'Maria');
    expect(prisma.areaTeacherNote.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: {
          userId: USER,
          areaId: AREA,
          teacherName: 'Maria',
          autoFromSchedule: false,
        },
        update: { teacherName: 'Maria', autoFromSchedule: false },
      }),
    );
  });
});
