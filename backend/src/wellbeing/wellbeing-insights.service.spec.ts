import { WellbeingInsightsService } from './wellbeing-insights.service';
import { INSIGHTS_WINDOW_DAYS } from './wellbeing.constants';
import type { PrismaService } from '../prisma/prisma.service';

type Log = {
  date: Date;
  mood: number;
  energy: number | null;
  stress: number | null;
};
type Session = {
  startedAt: Date;
  endedAt: Date | null;
  focusRating: number | null;
};

function setup(logs: Log[] = [], sessions: Session[] = []) {
  const prisma = {
    moodLog: { findMany: jest.fn().mockResolvedValue(logs) },
    studySession: { findMany: jest.fn().mockResolvedValue(sessions) },
  };
  const service = new WellbeingInsightsService(
    prisma as unknown as PrismaService,
  );
  return { service, prisma };
}

const NOW = new Date('2026-06-10T12:00:00Z');
const dayUtc = (daysAgo: number) => new Date(Date.UTC(2026, 5, 10 - daysAgo));
const sessionOn = (daysAgo: number, minutes: number, focus: number | null) => {
  const startedAt = new Date(dayUtc(daysAgo).getTime() + 10 * 3_600_000);
  return {
    startedAt,
    endedAt: new Date(startedAt.getTime() + minutes * 60_000),
    focusRating: focus,
  };
};

describe('WellbeingInsightsService.get', () => {
  beforeEach(() =>
    jest.useFakeTimers({
      now: NOW,
      doNotFake: ['nextTick', 'queueMicrotask'],
    }),
  );
  afterEach(() => jest.useRealTimers());

  it('scopes both queries to the user and to the window', async () => {
    const { service, prisma } = setup();
    await service.get('u1');

    const [logArg] = prisma.moodLog.findMany.mock.calls[0] as [
      { where: { userId: string; date: { gte: Date; lte: Date } } },
    ];
    expect(logArg.where.userId).toBe('u1');
    expect(logArg.where.date.lte).toEqual(dayUtc(0));
    expect(logArg.where.date.gte).toEqual(dayUtc(INSIGHTS_WINDOW_DAYS - 1));

    const [sessArg] = prisma.studySession.findMany.mock.calls[0] as [
      { where: { userId: string; endedAt: unknown } },
    ];
    expect(sessArg.where.userId).toBe('u1');
    expect(sessArg.where.endedAt).toEqual({ not: null });
  });

  it('no data: empty answer, null average, not_enough_data everywhere', async () => {
    const { service } = setup();
    const result = await service.get('u1');
    expect(result.windowDays).toBe(INSIGHTS_WINDOW_DAYS);
    expect(result.loggedDays).toBe(0);
    expect(result.averageMood).toBeNull();
    expect(result.moodVsFocus.kind).toBe('not_enough_data');
    expect(result.moodVsStudyMinutes.kind).toBe('not_enough_data');
    expect(result.energyVsFocus.kind).toBe('not_enough_data');
    expect(result.stressVsFocus.kind).toBe('not_enough_data');
  });

  it('averageMood is rounded to one decimal', async () => {
    const logs: Log[] = [3, 4, 4].map((mood, i) => ({
      date: dayUtc(i),
      mood,
      energy: null,
      stress: null,
    }));
    const { service } = setup(logs);
    const result = await service.get('u1');
    expect(result.loggedDays).toBe(3);
    expect(result.averageMood).toBe(3.7);
  });

  it('perfectly aligned mood and focus give a strong positive correlation', async () => {
    const logs: Log[] = [];
    const sessions: Session[] = [];
    for (let i = 0; i < 10; i++) {
      const value = (i % 5) + 1;
      logs.push({ date: dayUtc(i), mood: value, energy: value, stress: null });
      sessions.push(sessionOn(i, 30 + i, value));
    }
    const { service } = setup(logs, sessions);
    const result = await service.get('u1');
    expect(result.moodVsFocus).toMatchObject({ kind: 'ok', r: 1 });
    expect(result.energyVsFocus).toMatchObject({ kind: 'ok', r: 1 });
    // Stress nunca registado: nenhum par.
    expect(result.stressVsFocus.kind).toBe('not_enough_data');
  });

  it('days without sessions count as 0 minutes for mood vs study time', async () => {
    const logs: Log[] = Array.from({ length: 10 }, (_, i) => ({
      date: dayUtc(i),
      mood: (i % 5) + 1,
      energy: null,
      stress: null,
    }));
    const { service } = setup(logs, []);
    const result = await service.get('u1');
    // Todos os dias com 0 minutos: sem variacao, mas com amostra.
    expect(result.moodVsStudyMinutes).toMatchObject({
      kind: 'no_variation',
      sampleSize: 10,
    });
    // Sem sessoes nao ha foco para correlacionar.
    expect(result.moodVsFocus.kind).toBe('not_enough_data');
  });

  it('sessions without a rating do not feed the focus correlation', async () => {
    const logs: Log[] = Array.from({ length: 10 }, (_, i) => ({
      date: dayUtc(i),
      mood: (i % 5) + 1,
      energy: null,
      stress: null,
    }));
    const sessions = logs.map((_, i) => sessionOn(i, 30, null));
    const { service } = setup(logs, sessions);
    const result = await service.get('u1');
    expect(result.moodVsFocus.kind).toBe('not_enough_data');
  });

  it('ignores a session without endedAt', async () => {
    const logs: Log[] = Array.from({ length: 10 }, (_, i) => ({
      date: dayUtc(i),
      mood: (i % 5) + 1,
      energy: null,
      stress: null,
    }));
    const open = { ...sessionOn(0, 30, 5), endedAt: null };
    const { service } = setup(logs, [open]);
    const result = await service.get('u1');
    expect(result.moodVsStudyMinutes).toMatchObject({ kind: 'no_variation' });
  });

  it('negative duration sessions never produce negative minutes', async () => {
    const logs: Log[] = Array.from({ length: 10 }, (_, i) => ({
      date: dayUtc(i),
      mood: (i % 5) + 1,
      energy: null,
      stress: null,
    }));
    const s = sessionOn(0, 30, 3);
    const backwards = {
      ...s,
      endedAt: new Date(s.startedAt.getTime() - 60 * 60_000),
    };
    const { service } = setup(logs, [backwards]);
    const result = await service.get('u1');
    // Tudo a 0 minutos: continua sem variacao.
    expect(result.moodVsStudyMinutes).toMatchObject({ kind: 'no_variation' });
  });
});
