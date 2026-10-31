import type { Task } from '../types/models';
import { isExamTask } from './examMode';
import { hasFirmDate } from './taskReadiness';

// Folga entre avaliacoes: a fila dos proximos prazos academicos com quantos
// dias ha entre cada um e o anterior (o primeiro conta a partir de hoje). Os
// dias sao contados por data de calendario, nao por horas.
//
// Tres vistas: so testes/exames, so trabalhos (entregas), ou as duas juntas.
// Um trabalho em duas fases da duas paragens: a entrega e a apresentacao.

export type GapTone = 'tight' | 'short' | 'roomy';
export type GapMode = 'all' | 'tests' | 'work';
export type StopKind = 'test' | 'due' | 'handIn' | 'presentation';

export interface GapStop {
  /** Unico por paragem (uma task em duas fases tem duas). */
  id: string;
  task: Task;
  kind: StopKind;
  dayKey: string;
  /** Dias desde hoje ate esta paragem. */
  fromToday: number;
  /** Dias desde a paragem anterior (a primeira: desde hoje). */
  gap: number;
  tone: GapTone;
  /** A anterior e a entrega desta mesma task: nao conta como aperto entre avaliacoes. */
  followsOwnHandIn: boolean;
}

export interface DeadlineGaps {
  stops: GapStop[];
  /** Menor folga entre duas avaliacoes diferentes (null com menos de duas). */
  tightest: GapStop | null;
  /** Media de dias entre avaliacoes consecutivas (null com menos de duas). */
  averageGap: number | null;
}

// Ate 2 dias entre avaliacoes e apertado; ate 5 e curto.
export const TIGHT_GAP_DAYS = 2;
export const SHORT_GAP_DAYS = 5;
/** Teto da fila (as contas usam a fila toda, nao so o que esta a vista). */
export const MAX_GAP_STOPS = 40;

const COMPLETED_STATUS: Task['progressStatus'] = 'COMPLETED';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((Date.parse(`${toKey}T00:00:00Z`) - Date.parse(`${fromKey}T00:00:00Z`)) / MS_PER_DAY);
}

export function gapTone(days: number): GapTone {
  if (days <= TIGHT_GAP_DAYS) return 'tight';
  if (days <= SHORT_GAP_DAYS) return 'short';
  return 'roomy';
}

// Prazos de uma task que entram na vista. Revisoes espacadas tem tipo
// academico mas nao sao avaliacoes.
function deadlinesOf(task: Task, mode: GapMode): { kind: StopKind; dayKey: string }[] {
  if (task.progressStatus === COMPLETED_STATUS || !hasFirmDate(task)) return [];
  const day = task.date.slice(0, 10);
  if (isExamTask(task)) return mode === 'work' ? [] : [{ kind: 'test', dayKey: day }];
  if (mode === 'tests' || !task.academicType || task.spacedReviewOfTaskId) return [];
  if (task.submissionDate) {
    return [
      { kind: 'handIn', dayKey: task.submissionDate.slice(0, 10) },
      { kind: 'presentation', dayKey: day },
    ];
  }
  return [{ kind: 'due', dayKey: day }];
}

export function buildDeadlineGaps(tasks: Task[], todayKey: string, mode: GapMode = 'all'): DeadlineGaps {
  const upcoming = tasks
    .flatMap((task) => deadlinesOf(task, mode).map((d) => ({ ...d, task })))
    .filter((d) => d.dayKey >= todayKey)
    // Mesmo dia: os testes primeiro, depois pela ordem da task.
    .sort(
      (a, b) =>
        a.dayKey.localeCompare(b.dayKey) ||
        Number(b.kind === 'test') - Number(a.kind === 'test') ||
        a.task.date.localeCompare(b.task.date),
    )
    .slice(0, MAX_GAP_STOPS);

  let previousDay = todayKey;
  let previousTaskId: string | null = null;
  const stops = upcoming.map((d): GapStop => {
    const gap = daysBetween(previousDay, d.dayKey);
    const followsOwnHandIn = d.kind === 'presentation' && previousTaskId === d.task.id;
    previousDay = d.dayKey;
    previousTaskId = d.task.id;
    return {
      id: `${d.task.id}:${d.kind}`,
      task: d.task,
      kind: d.kind,
      dayKey: d.dayKey,
      fromToday: daysBetween(todayKey, d.dayKey),
      gap,
      tone: gapTone(gap),
      followsOwnHandIn,
    };
  });

  // Folgas entre avaliacoes (sem a primeira, que e desde hoje, nem a de uma
  // apresentacao logo a seguir a sua propria entrega).
  const between = stops.slice(1).filter((stop) => !stop.followsOwnHandIn);
  const tightest = between.reduce<GapStop | null>((min, stop) => (!min || stop.gap < min.gap ? stop : min), null);
  const averageGap =
    between.length > 0 ? Math.round((between.reduce((sum, stop) => sum + stop.gap, 0) / between.length) * 10) / 10 : null;

  return { stops, tightest, averageGap };
}
