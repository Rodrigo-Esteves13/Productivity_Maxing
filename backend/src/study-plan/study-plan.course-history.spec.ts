// B-34: o historico por cadeira (tasks concluidas) soma o tempo das sessoes
// no Postgres em vez de carregar as sessoes aninhadas. Sem janela: os totais
// de GET /study-plan/courses ficam iguais. Prisma e services em mock.
jest.mock('../push/push.service', () => ({ PushService: class {} }));

import { Prisma } from '@prisma/client';
import { StudyPlanService } from './study-plan.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { ScheduleService } from '../schedule/schedule.service';
import type { StudySessionsService } from '../study-sessions/study-sessions.service';
import type { WorkShiftsService } from '../work-shifts/work-shifts.service';
import type { PredictionService } from '../prediction/prediction.service';
import type { ItineraryService } from '../schedule/itinerary.service';
import { hasStudyTimeWhere } from '../common/session-minutes.util';

const SECONDS_PER_MINUTE = 60;

const DONE = [
  { id: 't1', areaId: 'a1', weightPercentage: 40, recalledStudyMinutes: null },
  { id: 't2', areaId: 'a1', weightPercentage: 0, recalledStudyMinutes: 50 },
  { id: 't3', areaId: 'a2', weightPercentage: null, recalledStudyMinutes: 9 },
];

const SESSION_ROWS = [
  // t1: 120 min sem nota + 60 min com nota 1 (pesa 0.5) = 150 efetivos.
  { taskId: 't1', focusRating: null, seconds: 120 * SECONDS_PER_MINUTE },
  { taskId: 't1', focusRating: 1, seconds: 60 * SECONDS_PER_MINUTE },
  // t3: 100 min com nota 2 (pesa 0.7) = 70; o tempo recordado e ignorado.
  { taskId: 't3', focusRating: 2, seconds: 100 * SECONDS_PER_MINUTE },
];

function setup() {
  const findMany = jest.fn(({ where }: { where: Record<string, unknown> }) =>
    Promise.resolve(where.progressStatus === 'COMPLETED' ? DONE : []),
  );
  const prisma = {
    task: { findMany },
    $queryRaw: jest.fn().mockResolvedValue(SESSION_ROWS),
    area: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'a1', name: 'Redes', colorHex: 'area-1' },
        { id: 'a2', name: 'Sistemas', colorHex: 'area-2' },
      ]),
    },
  };
  const prediction = {
    getCalibrationFactor: jest.fn().mockResolvedValue(null),
    predictForTasks: jest.fn().mockResolvedValue({
      method: 'insufficient_data',
      minutesByTaskId: new Map(),
    }),
  };
  const service = new StudyPlanService(
    prisma as unknown as PrismaService,
    {} as ScheduleService,
    {} as StudySessionsService,
    {} as WorkShiftsService,
    prediction as unknown as PredictionService,
    {} as ItineraryService,
  );
  return { service, prisma, findMany };
}

describe('StudyPlanService course history (SQL sums)', () => {
  it('builds the per-course totals from SQL-summed session time', async () => {
    const { service, prisma, findMany } = setup();

    const courses = await service.courses('u1');

    const doneCall = findMany.mock.calls.find(
      ([args]) => args.where.progressStatus === 'COMPLETED',
    ) as [{ where: Record<string, unknown>; select: Record<string, unknown> }];
    expect(doneCall[0].where).toEqual({
      userId: 'u1',
      progressStatus: 'COMPLETED',
      AND: [hasStudyTimeWhere()],
    });
    expect(doneCall[0].select).not.toHaveProperty('studySessions');

    const [query] = prisma.$queryRaw.mock.calls[0] as [Prisma.Sql];
    expect(query.values).toEqual(['u1', ['t1', 't2', 't3']]);

    expect(courses).toEqual([
      expect.objectContaining({
        areaId: 'a1',
        areaName: 'Redes',
        studiedMinutes: 200,
        completedTasks: 2,
        avgMinutesPerCompletedTask: 100,
        avgMinutesPerGradedTask: 150,
        pendingTasks: 0,
      }),
      expect.objectContaining({
        areaId: 'a2',
        studiedMinutes: 70,
        completedTasks: 1,
        avgMinutesPerCompletedTask: 70,
        avgMinutesPerGradedTask: null,
      }),
    ]);
  });
});
