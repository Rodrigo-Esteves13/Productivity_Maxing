import { NotFoundException } from '@nestjs/common';
import { CalendarFeedService, parseFeedScope } from './calendar-feed.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { ScheduleService } from '../../schedule/schedule.service';
import type { WorkShiftsService } from '../../work-shifts/work-shifts.service';
import type { StudyPlanService } from '../../study-plan/study-plan.service';
import type { ItineraryService } from '../../schedule/itinerary.service';

const TOKEN = 'a'.repeat(64);

describe('parseFeedScope', () => {
  it('only accepts known scopes and defaults to everything', () => {
    expect(parseFeedScope('tasks')).toBe('tasks');
    expect(parseFeedScope('all')).toBe('all');
    expect(parseFeedScope('classes; DROP')).toBe('all');
    expect(parseFeedScope(undefined)).toBe('all');
  });
});

describe('CalendarFeedService scopes', () => {
  const setup = () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'u1', status: 'ACTIVE' }),
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ calendarFeedToken: TOKEN }),
        update: jest.fn().mockResolvedValue({}),
      },
      task: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const schedule = { findRange: jest.fn().mockResolvedValue([]) };
    const service = new CalendarFeedService(
      prisma as unknown as PrismaService,
      schedule as unknown as ScheduleService,
      {
        expandRange: jest.fn().mockResolvedValue([]),
      } as unknown as WorkShiftsService,
      {
        generate: jest.fn().mockResolvedValue({ suggestions: [] }),
      } as unknown as StudyPlanService,
      {
        buildRange: jest.fn().mockResolvedValue([]),
      } as unknown as ItineraryService,
    );
    return { prisma, schedule, service };
  };

  it('tasks-only skips classes, shifts and the study plan', async () => {
    const { prisma, schedule, service } = setup();
    const body = await service.buildFeedForToken(TOKEN, 'tasks');
    expect(body).toContain('BEGIN:VCALENDAR');
    expect(schedule.findRange).not.toHaveBeenCalled();
    const [taskQuery] = prisma.task.findMany.mock.calls[0] as [
      { where: Record<string, unknown> },
    ];
    expect(taskQuery.where).toMatchObject({ userId: 'u1' });
  });

  it('a two-phase task adds an all-day hand-in event', async () => {
    const { prisma, service } = setup();
    const soon = new Date();
    soon.setUTCHours(0, 0, 0, 0);
    soon.setUTCDate(soon.getUTCDate() + 5);
    const handIn = new Date(soon);
    handIn.setUTCDate(handIn.getUTCDate() - 2);
    prisma.task.findMany.mockResolvedValue([
      {
        id: 't1',
        title: 'Relatorio',
        date: soon,
        dateCertainty: 'EXACT',
        submissionDate: handIn,
        topics: null,
        calendarDurationMinutes: null,
        area: { name: 'Redes' },
      },
    ]);
    const body = await service.buildFeedForToken(TOKEN, 'tasks');
    expect(body).toContain('UID:task-handin:t1@productivitymaxing');
    expect(body).toContain('SUMMARY:Hand in: Relatorio');
  });

  it('a revoked token stops working for every scope', async () => {
    const { prisma, service } = setup();
    await service.buildFeedForToken(TOKEN, 'tasks');
    await service.buildFeedForToken(TOKEN, 'all');
    await service.disable('u1');
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(
      service.buildFeedForToken(TOKEN, 'tasks'),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.buildFeedForToken(TOKEN, 'all'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
