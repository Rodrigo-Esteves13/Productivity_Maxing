import type { Task } from '../types/models';
import { upcomingExams } from './examMode';

// Folga entre testes: a fila dos proximos testes/exames com quantos dias ha
// entre cada um e o anterior (o primeiro conta a partir de hoje). Os dias
// sao contados por data de calendario, nao por horas.

export type GapTone = 'tight' | 'short' | 'roomy';

export interface TestStop {
  task: Task;
  dayKey: string;
  /** Dias desde hoje ate este teste. */
  fromToday: number;
  /** Dias desde o teste anterior (o primeiro: desde hoje). */
  gap: number;
  tone: GapTone;
}

export interface TestGaps {
  stops: TestStop[];
  /** Os testes que nao couberam na lista. */
  hidden: number;
  /** Menor folga entre dois testes (null com menos de dois). */
  tightest: TestStop | null;
  /** Media de dias entre testes consecutivos (null com menos de dois). */
  averageGap: number | null;
}

// Ate 2 dias entre testes e apertado; ate 5 e curto.
export const TIGHT_GAP_DAYS = 2;
export const SHORT_GAP_DAYS = 5;
export const MAX_TEST_STOPS = 8;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((Date.parse(`${toKey}T00:00:00Z`) - Date.parse(`${fromKey}T00:00:00Z`)) / MS_PER_DAY);
}

export function gapTone(days: number): GapTone {
  if (days <= TIGHT_GAP_DAYS) return 'tight';
  if (days <= SHORT_GAP_DAYS) return 'short';
  return 'roomy';
}

export function buildTestGaps(tasks: Task[], todayKey: string, limit = MAX_TEST_STOPS): TestGaps {
  const exams = upcomingExams(tasks, todayKey);
  const shown = exams.slice(0, limit);
  let previous = todayKey;
  const stops = shown.map((task): TestStop => {
    const dayKey = task.date.slice(0, 10);
    const gap = daysBetween(previous, dayKey);
    previous = dayKey;
    return { task, dayKey, fromToday: daysBetween(todayKey, dayKey), gap, tone: gapTone(gap) };
  });

  // Folgas entre testes (sem a primeira, que e desde hoje).
  const between = stops.slice(1);
  const tightest = between.reduce<TestStop | null>((min, stop) => (!min || stop.gap < min.gap ? stop : min), null);
  const averageGap =
    between.length > 0 ? Math.round((between.reduce((sum, stop) => sum + stop.gap, 0) / between.length) * 10) / 10 : null;

  return { stops, hidden: exams.length - shown.length, tightest, averageGap };
}
