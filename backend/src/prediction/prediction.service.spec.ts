// B-34/S-17: tempo de estudo por task somado no Postgres (sem sessoes
// aninhadas) e janela de 12 meses no treino/calibracao. Prisma em mock.
import { Prisma } from '@prisma/client';
import { PredictionService } from './prediction.service';
import type { PrismaService } from '../prisma/prisma.service';
import { hasStudyTimeWhere } from '../common/session-minutes.util';
import { MS_PER_DAY } from '../common/time.constants';
import { PREDICTION_HISTORY_WINDOW_DAYS } from './prediction.constants';

const SECONDS_PER_MINUTE = 60;

type TaskRow = {
  id: string;
  estimatedMinutes: number | null;
  recalledStudyMinutes: number | null;
};

function setup(tasks: TaskRow[], sessionRows: unknown[]) {
  const prisma = {
    task: { findMany: jest.fn().mockResolvedValue(tasks) },
    $queryRaw: jest.fn().mockResolvedValue(sessionRows),
  };
  const service = new PredictionService(prisma as unknown as PrismaService);
  return { service, prisma };
}

const whereOf = (mock: jest.Mock) =>
  (mock.mock.calls[0] as [{ where: Record<string, unknown> }])[0].where;

// Janela usada no where: completedAt recente, ou sem completedAt e com data
// recente.
function expectHistoryWindow(where: Record<string, unknown>, now: number) {
  const and = where.AND as Prisma.TaskWhereInput[];
  expect(and[0]).toEqual(hasStudyTimeWhere());
  const window = and[1] as {
    OR: [
      { completedAt: { gte: Date } },
      { completedAt: null; date: { gte: Date } },
    ];
  };
  const since = window.OR[0].completedAt.gte.getTime();
  expect(now - since).toBe(PREDICTION_HISTORY_WINDOW_DAYS * MS_PER_DAY);
  expect(window.OR[1]).toEqual({
    completedAt: null,
    date: { gte: window.OR[0].completedAt.gte },
  });
}

describe('PredictionService.getEstimationAccuracy (SQL sums)', () => {
  it('sums session time per task in SQL and keeps the same metrics', async () => {
    const { service, prisma } = setup(
      [
        // 60 estimados, 60 reais: acertada.
        { id: 't1', estimatedMinutes: 60, recalledStudyMinutes: null },
        // Sem sessoes: usa o tempo recordado (200): subestimada.
        { id: 't2', estimatedMinutes: 100, recalledStudyMinutes: 200 },
        // 30 + 30 min (notas diferentes) = 60 de relogio: sobrestimada.
        { id: 't3', estimatedMinutes: 100, recalledStudyMinutes: 500 },
      ],
      [
        { taskId: 't1', focusRating: null, seconds: 60 * SECONDS_PER_MINUTE },
        { taskId: 't3', focusRating: 1, seconds: 30 * SECONDS_PER_MINUTE },
        {
          taskId: 't3',
          focusRating: 5,
          seconds: new Prisma.Decimal(30 * SECONDS_PER_MINUTE),
        },
      ],
    );

    const result = await service.getEstimationAccuracy('u1');

    expect(whereOf(prisma.task.findMany)).toEqual({
      userId: 'u1',
      estimatedMinutes: { gt: 0 },
      AND: [hasStudyTimeWhere()],
    });
    const [query] = prisma.$queryRaw.mock.calls[0] as [Prisma.Sql];
    expect(query.text).toContain('s."userId" = $1');
    expect(query.text).toContain('s."taskId" = ANY($2::text[])');
    expect(query.text).toContain('GROUP BY s."taskId", s."focusRating"');
    expect(query.values).toEqual(['u1', ['t1', 't2', 't3']]);

    expect(result).toEqual({
      sampleSize: 3,
      avgAbsPercentError: 46.7,
      avgEstimatedMinutes: 87,
      avgActualMinutes: 107,
      accurateCount: 1,
      overestimatedCount: 1,
      underestimatedCount: 1,
    });
  });

  it('no tasks: no SQL and the empty answer', async () => {
    const { service, prisma } = setup([], []);
    const result = await service.getEstimationAccuracy('u1');
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(result.sampleSize).toBe(0);
    expect(result.avgAbsPercentError).toBeNull();
  });
});

describe('PredictionService.getCalibrationFactor (window + SQL sums)', () => {
  const NOW = Date.parse('2026-11-22T12:00:00.000Z');
  beforeEach(() =>
    jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'queueMicrotask'] }),
  );
  afterEach(() => jest.useRealTimers());

  it('only completed tasks of the last 12 months, summed in SQL', async () => {
    const tasks = ['a', 'b', 'c'].map((id) => ({
      id,
      estimatedMinutes: 60,
      recalledStudyMinutes: null,
    }));
    const rows = tasks.map((t) => ({
      taskId: t.id,
      focusRating: 3,
      seconds: 90 * SECONDS_PER_MINUTE,
    }));
    const { service, prisma } = setup(tasks, rows);

    await expect(service.getCalibrationFactor('u1')).resolves.toBe(1.5);

    const where = whereOf(prisma.task.findMany);
    expect(where).toMatchObject({
      userId: 'u1',
      progressStatus: 'COMPLETED',
      estimatedMinutes: { gt: 0 },
    });
    expectHistoryWindow(where, NOW);
  });

  it('under the minimum sample there is no factor', async () => {
    const { service } = setup(
      [{ id: 'a', estimatedMinutes: 60, recalledStudyMinutes: 90 }],
      [],
    );
    await expect(service.getCalibrationFactor('u1')).resolves.toBeNull();
  });
});

describe('PredictionService training rows (window + SQL sums)', () => {
  const NOW = Date.parse('2026-11-22T12:00:00.000Z');
  beforeEach(() =>
    jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'queueMicrotask'] }),
  );
  afterEach(() => jest.useRealTimers());

  it('loads training tasks of the window without nested sessions', async () => {
    const { service, prisma } = setup(
      [
        {
          id: 't1',
          estimatedMinutes: null,
          recalledStudyMinutes: null,
        },
      ],
      [{ taskId: 't1', focusRating: null, seconds: 600 }],
    );

    const result = await service.predictForTasks('u1', [
      {
        id: 'p1',
        taskTypeId: 'type',
        areaId: 'area',
        difficulty: 'MEDIUM',
        weightPercentage: null,
      },
    ]);

    // 1 amostra < minimo da regressao: sem previsao, mas a consulta e leve.
    expect(result.method).toBe('insufficient_data');
    const args = (
      prisma.task.findMany.mock.calls[0] as [
        { where: Record<string, unknown>; select: Record<string, unknown> },
      ]
    )[0];
    expect(args.select).not.toHaveProperty('studySessions');
    expect(args.where.userId).toBe('u1');
    expectHistoryWindow(args.where, NOW);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });
});
