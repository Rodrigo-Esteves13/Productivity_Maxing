import type { PrismaService } from '../prisma/prisma.service';
import type { PushService } from '../push/push.service';
import type { CourseRiskService } from '../course-risk/course-risk.service';
import type { CourseRiskOverviewRow } from '../course-risk/course-risk-overview.types';
import {
  ALMOST_THERE_FROM_PCT,
  almostThereRows,
  GradeAlmostThereRemindersService,
} from './grade-almost-there-reminders.service';
import { FakeSentNotificationService } from './sent-notification.fake';

// Novembro: Lisboa = UTC.
const MORNING = new Date('2026-11-11T10:00:00.000Z');
const NIGHT = new Date('2026-11-11T23:00:00.000Z');
const NEXT_DAY = new Date('2026-11-12T10:00:00.000Z');

function row(
  areaId: string,
  gradedWeightPct: number,
  status: CourseRiskOverviewRow['status'] = 'assessed',
): CourseRiskOverviewRow {
  return {
    areaId,
    areaName: `Area ${areaId}`,
    colorHex: '#000000',
    status,
    risk: null,
    passChancePct: null,
    failChancePct: null,
    confidence: null,
    gradedWeightPct,
  };
}

function setup(
  courses: CourseRiskOverviewRow[],
  opts: {
    delivered?: number;
    quiet?: { start: number; end: number };
  } = {},
) {
  const prisma = {
    user: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'u1',
          quietHoursStart: opts.quiet?.start ?? null,
          quietHoursEnd: opts.quiet?.end ?? null,
        },
      ]),
    },
  };
  const push = {
    notifyUser: jest.fn().mockResolvedValue(opts.delivered ?? 1),
  };
  const courseRisk = { overview: jest.fn().mockResolvedValue({ courses }) };
  const sent = new FakeSentNotificationService();
  const service = new GradeAlmostThereRemindersService(
    prisma as unknown as PrismaService,
    push as unknown as PushService,
    courseRisk as unknown as CourseRiskService,
    sent.asService(),
  );
  return { service, prisma, push, courseRisk, sent };
}

describe('almostThereRows', () => {
  it('keeps assessed courses between the threshold and 100%', () => {
    const rows = [
      row('a', ALMOST_THERE_FROM_PCT - 1),
      row('b', ALMOST_THERE_FROM_PCT),
      row('c', 99.5),
      row('d', 100),
      row('e', 90, 'not_enough_data'),
    ];
    expect(almostThereRows(rows).map((r) => r.areaId)).toEqual(['b', 'c']);
  });
});

describe('GradeAlmostThereRemindersService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(MORNING);
  });
  afterEach(() => jest.useRealTimers());

  it('pushes the remaining weight once per course', async () => {
    const { service, push } = setup([row('a', 88), row('b', 40)]);
    expect(await service.sendReminders()).toBe(1);
    expect(push.notifyUser).toHaveBeenCalledTimes(1);
    expect(push.notifyUser).toHaveBeenCalledWith('u1', 'gradeAlmostThere', {
      title: 'Area a',
      count: 12,
      url: '/course-risk',
    });
  });

  it('never repeats the same course on a later day', async () => {
    const { service, push } = setup([row('a', 90)]);
    expect(await service.sendReminders()).toBe(1);
    jest.setSystemTime(NEXT_DAY);
    expect(await service.sendReminders()).toBe(0);
    expect(push.notifyUser).toHaveBeenCalledTimes(1);
  });

  it('evaluates a user at most once per day', async () => {
    const { service, courseRisk } = setup([row('a', 10)]);
    await service.sendReminders();
    await service.sendReminders();
    expect(courseRisk.overview).toHaveBeenCalledTimes(1);
  });

  it('does nothing outside the daytime window', async () => {
    const { service, prisma } = setup([row('a', 90)]);
    jest.setSystemTime(NIGHT);
    expect(await service.sendReminders()).toBe(0);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('skips users in quiet hours', async () => {
    const { service, courseRisk } = setup([row('a', 90)], {
      quiet: { start: 9 * 60, end: 12 * 60 },
    });
    expect(await service.sendReminders()).toBe(0);
    expect(courseRisk.overview).not.toHaveBeenCalled();
  });

  it('releases the marker when no device received the push', async () => {
    const { service, sent } = setup([row('a', 90)], { delivered: 0 });
    expect(await service.sendReminders()).toBe(0);
    expect(sent.rows.size).toBe(0);
  });

  it('a failing user does not abort the run', async () => {
    const { service, courseRisk } = setup([row('a', 90)]);
    courseRisk.overview.mockRejectedValue(new Error('db down'));
    expect(await service.sendReminders()).toBe(0);
  });
});
