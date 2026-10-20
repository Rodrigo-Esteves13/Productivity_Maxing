// Simulacao ponta a ponta das previsoes (nota prevista + efeito do foco)
// com alunos sinteticos: os servicos reais correm sobre uma BD simulada e
// cada cenario diz o que DEVE sair. Correr com PRINT_SIMULATION=1 imprime
// um resumo de cada cenario.
import { GradeProjectionService } from './grade-projection.service';
import { FocusEffectService } from './focus-effect.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { StudyPlanService } from './study-plan.service';

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;
const TODAY = Date.UTC(2026, 9, 19);

// Gerador determinista (mulberry32): o mesmo cenario da sempre o mesmo.
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Student {
  graded: number;
  areas: number;
  // 'task': sessoes ligadas a task; 'area': so a cadeira, antes do prazo.
  sessionsBy: 'task' | 'area';
  // Peso do tempo e do foco na nota (0 = nenhum).
  timeWeight: number;
  focusWeight: number;
  noise: number;
  constantFocus?: number;
  // Tasks com estudo de 5 minutos (abriu e fechou a sessao).
  tinySessions?: number;
  interestByArea?: number[];
  pending?: number;
  seed?: number;
}

interface Built {
  tasks: Record<string, unknown>[];
  sessions: Record<string, unknown>[];
  interests: { areaId: string; rating: number }[];
  pending: Record<string, unknown>[];
}

function buildStudent(spec: Student): Built {
  const random = rng(spec.seed ?? 7);
  const tasks: Record<string, unknown>[] = [];
  const sessions: Record<string, unknown>[] = [];
  for (let i = 0; i < spec.graded; i++) {
    const areaIndex = i % spec.areas;
    const areaId = `area${areaIndex}`;
    const deadline = TODAY - (spec.graded - i) * 9 * MS_PER_DAY;
    const tiny = i < (spec.tinySessions ?? 0);
    const minutes = tiny ? 5 : 60 + Math.round(random() * 540);
    const focus = spec.constantFocus ?? 1 + Math.round(random() * 4);
    const interest = spec.interestByArea?.[areaIndex] ?? 3;
    const signal =
      spec.timeWeight * Math.log(1 + minutes / 60) +
      spec.focusWeight * (focus - 3) +
      0.4 * (interest - 3);
    const grade = Math.max(
      0,
      Math.min(20, 9 + signal + (random() - 0.5) * 2 * spec.noise),
    );
    tasks.push({
      id: `t${i}`,
      title: `Teste ${i}`,
      areaId,
      date: new Date(deadline),
      realGrade: Math.round(grade * 10) / 10,
      recalledStudyMinutes: null,
      area: { name: `Cadeira ${areaIndex}`, colorHex: '#8b5cf6' },
      period: { program: { gradeScale: '0-20' } },
    });
    // Duas sessoes por task, nos dias antes do prazo.
    for (const [part, daysBefore] of [
      [0.6, 6],
      [0.4, 2],
    ] as const) {
      const startedAt = new Date(
        deadline - daysBefore * MS_PER_DAY + 10 * 3_600_000,
      );
      sessions.push({
        taskId: spec.sessionsBy === 'task' ? `t${i}` : null,
        areaId,
        startedAt,
        endedAt: new Date(startedAt.getTime() + minutes * part * MS_PER_MINUTE),
        focusRating: focus,
      });
    }
  }
  const pending = Array.from({ length: spec.pending ?? 2 }, (_, i) => ({
    id: `p${i}`,
    title: `Exame ${i}`,
    areaId: `area${i % spec.areas}`,
    date: new Date(TODAY + (i + 5) * MS_PER_DAY),
    weightPercentage: 40,
    targetGrade: 16,
    difficulty: 'MEDIUM',
    estimatedMinutes: 240,
    taskTypeId: null,
    studySessions: [],
    area: { name: `Cadeira ${i}`, colorHex: '#06b6d4' },
    period: { program: { gradeScale: '0-20' } },
  }));
  const interests = (spec.interestByArea ?? []).map((rating, i) => ({
    areaId: `area${i}`,
    rating,
  }));
  return { tasks, sessions, interests, pending };
}

// BD simulada: responde a cada consulta pelo formato do `where`.
function fakePrisma(data: Built) {
  const findTasks = jest.fn((args: { where: Record<string, unknown> }) => {
    const where = args.where;
    if ('progressStatus' in where) return Promise.resolve(data.pending);
    if ('areaId' in where) {
      return Promise.resolve(
        data.tasks.map((t) => ({ id: t.id, areaId: t.areaId, date: t.date })),
      );
    }
    return Promise.resolve(
      [...data.tasks].sort(
        (a, b) => (b.date as Date).getTime() - (a.date as Date).getTime(),
      ),
    );
  });
  return {
    task: { findMany: findTasks },
    studySession: { findMany: jest.fn().mockResolvedValue(data.sessions) },
    areaInterest: { findMany: jest.fn().mockResolvedValue(data.interests) },
  } as unknown as PrismaService;
}

async function simulate(spec: Student) {
  const data = buildStudent(spec);
  const prisma = fakePrisma(data);
  const studyPlan = {
    resolveEstimates: jest.fn().mockResolvedValue({
      byTaskId: new Map(
        data.pending.map((p) => [p.id, { estimate: { minutes: 300 } }]),
      ),
    }),
  } as unknown as StudyPlanService;
  const projection = await new GradeProjectionService(
    prisma,
    studyPlan,
  ).project('u');
  const effect = await new FocusEffectService(prisma).compute('u');
  const scatter = await new FocusEffectService(prisma).scatter('u');
  return { projection, effect, scatter };
}

const summaries: Record<string, unknown>[] = [];
afterAll(() => {
  if (process.env.PRINT_SIMULATION) console.table(summaries);
});
const record = (name: string, r: Awaited<ReturnType<typeof simulate>>) =>
  summaries.push({
    scenario: name,
    projection: r.projection.status,
    trainingSamples: r.projection.trainingSamples,
    firstPrediction: r.projection.tasks[0]?.projectedGrade ?? '-',
    focus: r.effect.focus.status,
    focusPoints: r.effect.focus.gradePointsPerPoint ?? '-',
    interest: r.effect.interest.status,
    scatterDots: r.scatter.points.length,
  });

const STRONG = { timeWeight: 3, focusWeight: 1.2, noise: 0.6 };

describe('simulacao das previsoes', () => {
  it('10 testes com sessoes na task e relacao forte: preve nota e mede o foco', async () => {
    const r = await simulate({
      graded: 10,
      areas: 2,
      sessionsBy: 'task',
      ...STRONG,
    });
    record('task sessions, strong', r);
    expect(r.projection.status).toBe('ready');
    expect(r.projection.trainingSamples).toBe(10);
    expect(r.projection.tasks[0].projectedGrade).not.toBeNull();
    expect(r.effect.focus.status).toBe('clear');
    expect(r.effect.focus.gradePointsPerPoint).toBeGreaterThan(0);
    expect(r.scatter.points).toHaveLength(10);
  });

  it('o mesmo aluno a estudar pela cadeira (sem escolher task) da o mesmo resultado', async () => {
    const byTask = await simulate({
      graded: 10,
      areas: 2,
      sessionsBy: 'task',
      ...STRONG,
    });
    const byArea = await simulate({
      graded: 10,
      areas: 2,
      sessionsBy: 'area',
      ...STRONG,
    });
    record('area sessions, strong', byArea);
    expect(byArea.projection.status).toBe('ready');
    expect(byArea.projection.trainingSamples).toBe(10);
    expect(byArea.effect.focus.status).toBe('clear');
    expect(byArea.projection.tasks[0].projectedGrade).toBe(
      byTask.projection.tasks[0].projectedGrade,
    );
    expect(byArea.scatter.points).toHaveLength(10);
  });

  it('com 4 testes diz quantos faltam, sem inventar', async () => {
    const r = await simulate({
      graded: 4,
      areas: 2,
      sessionsBy: 'task',
      ...STRONG,
    });
    record('only 4 graded', r);
    expect(r.projection.status).toBe('not_enough_data');
    expect(r.projection.trainingSamples).toBe(4);
    expect(r.effect.focus.status).toBe('not_enough_data');
  });

  it('sessoes de 5 minutos nao contam como dados (e a contagem diz isso)', async () => {
    const r = await simulate({
      graded: 7,
      areas: 2,
      sessionsBy: 'task',
      tinySessions: 2,
      ...STRONG,
    });
    record('7 graded, 2 with 5-minute study', r);
    expect(r.projection.trainingSamples).toBe(5);
    expect(r.projection.status).toBe('not_enough_data');
  });

  it('notas ao acaso: nao ha relacao e nao se mostra numero', async () => {
    const r = await simulate({
      graded: 12,
      areas: 2,
      sessionsBy: 'task',
      timeWeight: 0,
      focusWeight: 0,
      noise: 8,
      seed: 3,
    });
    record('random grades', r);
    expect(r.projection.status).toBe('no_clear_link');
    expect(r.projection.tasks.every((t) => t.projectedGrade === null)).toBe(
      true,
    );
    expect(['inconclusive', 'no_variation']).toContain(r.effect.focus.status);
  });

  it('foco sempre igual: diz que nao ha variacao', async () => {
    const r = await simulate({
      graded: 10,
      areas: 2,
      sessionsBy: 'task',
      constantFocus: 4,
      ...STRONG,
    });
    record('constant focus', r);
    expect(r.effect.focus.status).toBe('no_variation');
    expect(r.projection.status).toBe('ready');
  });

  it('interesse diferente em 4 cadeiras com 16 testes: mede o interesse', async () => {
    const r = await simulate({
      graded: 16,
      areas: 4,
      sessionsBy: 'task',
      interestByArea: [1, 2, 4, 5],
      ...STRONG,
    });
    record('interest in 4 courses', r);
    expect(r.effect.interest.status).not.toBe('not_enough_data');
    expect(r.effect.interest.areasMissingInterest).toBe(0);
  });
});
