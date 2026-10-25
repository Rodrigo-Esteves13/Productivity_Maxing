import { DateCertainty } from '@prisma/client';
import { resolveEstimate } from './study-plan.estimates';
import {
  DEFAULT_MINUTES_UNGRADED,
  EFFORT_MULTIPLIER,
} from './study-plan.constants';
import { planStudyBlocks, SchedulerDay } from './study-plan.scheduler';
import {
  ACTIONABLE_DEADLINE_WHERE,
  calendarTitle,
  hasFirmDate,
} from '../common/task-readiness.util';

const baseInput = {
  manualMinutes: null,
  predictedMinutes: null,
  courseHistoryMinutes: null,
  difficulty: 'EASY' as const,
  isGraded: false,
};

describe('resolveEstimate com esforco', () => {
  it('escala a tabela por dificuldade: facil mas exaustiva pede mais tempo', () => {
    const plain = resolveEstimate({ ...baseInput, effort: null }, null);
    const exhaustive = resolveEstimate(
      { ...baseInput, effort: 'EXHAUSTIVE' },
      null,
    );
    expect(plain.minutes).toBe(DEFAULT_MINUTES_UNGRADED.EASY);
    expect(exhaustive.minutes).toBe(
      Math.round(DEFAULT_MINUTES_UNGRADED.EASY * EFFORT_MULTIPLIER.EXHAUSTIVE),
    );
  });

  it('nunca mexe numa estimativa escrita pelo user', () => {
    const manual = resolveEstimate(
      { ...baseInput, manualMinutes: 90, effort: 'EXHAUSTIVE' },
      null,
    );
    expect(manual).toEqual({ minutes: 90, source: 'manual' });
  });

  it('escala o historico da cadeira', () => {
    const history = resolveEstimate(
      { ...baseInput, courseHistoryMinutes: 100, effort: 'LIGHT' },
      null,
    );
    expect(history.minutes).toBe(Math.round(100 * EFFORT_MULTIPLIER.LIGHT));
    expect(history.source).toBe('course_history');
  });
});

const day = (key: string, dayOfWeek: number): SchedulerDay => ({
  key,
  dayOfWeek,
  classMinutes: 0,
  workMinutes: 0,
  freeSlots: [{ start: 9 * 60, end: 18 * 60 }],
});

const DAYS = [
  day('2026-11-02', 1),
  day('2026-11-03', 2),
  day('2026-11-04', 3),
  day('2026-11-05', 4),
  day('2026-11-06', 5),
];

const CONFIG = {
  dailyLimitMinutes: 240,
  overtimeExtraMinutes: 60,
  minBlockMinutes: 25,
};

describe('planStudyBlocks com firstUsableKey', () => {
  it('nao planeia nada antes do dia em que a task abre', () => {
    const output = planStudyBlocks(
      DAYS,
      [
        {
          taskId: 't1',
          areaId: 'a1',
          deadlineKey: '2026-11-06',
          firstUsableKey: '2026-11-04',
          weightPercentage: null,
          difficultyRank: 3,
          neededMinutes: 180,
          isEvent: false,
        },
      ],
      CONFIG,
      () => 0,
    );
    const taskBlocks = output.blocks.filter((b) => b.taskId === 't1');
    expect(taskBlocks.length).toBeGreaterThan(0);
    expect(taskBlocks.every((b) => b.date >= '2026-11-04')).toBe(true);
    expect(output.byTask.get('t1')?.plannedMinutes).toBe(180);
  });

  it('abre depois do prazo: estuda no dia em que abre em vez de falhar', () => {
    const output = planStudyBlocks(
      DAYS,
      [
        {
          taskId: 't2',
          areaId: 'a1',
          deadlineKey: '2026-11-03',
          firstUsableKey: '2026-11-05',
          weightPercentage: null,
          difficultyRank: 3,
          neededMinutes: 60,
          isEvent: false,
        },
      ],
      CONFIG,
      () => 0,
    );
    const dates = output.blocks
      .filter((b) => b.taskId === 't2')
      .map((b) => b.date);
    expect(new Set(dates)).toEqual(new Set(['2026-11-05']));
  });
});

describe('task-readiness.util', () => {
  it('so EXACT e APPROXIMATE sao prazos reais', () => {
    expect(hasFirmDate(DateCertainty.EXACT)).toBe(true);
    expect(hasFirmDate(DateCertainty.APPROXIMATE)).toBe(true);
    expect(hasFirmDate(DateCertainty.UNKNOWN)).toBe(false);
    expect(hasFirmDate(DateCertainty.SURPRISE)).toBe(false);
  });

  it('o filtro de prazos exclui tasks bloqueadas', () => {
    expect(ACTIONABLE_DEADLINE_WHERE.isBlocked).toBe(false);
    expect(ACTIONABLE_DEADLINE_WHERE.dateCertainty.in).not.toContain(
      DateCertainty.SURPRISE,
    );
  });
});

describe('calendarTitle', () => {
  it('marca datas que sao so palpite e deixa as exatas como estao', () => {
    expect(calendarTitle('Teste', 'EXACT')).toBe('Teste');
    expect(calendarTitle('Teste', 'APPROXIMATE')).toBe('~ Teste');
    expect(calendarTitle('Teste', 'UNKNOWN')).toBe('(TBD) Teste');
    expect(calendarTitle('Teste', 'SURPRISE')).toBe('(?) Teste');
  });
});
