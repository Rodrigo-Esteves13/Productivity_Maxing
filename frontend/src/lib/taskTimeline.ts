import type { Task } from '../types/models';

// Vista Timeline (Gantt simples): uma barra por task aberta, de quando abre
// (availableFrom, ou hoje) ate ao prazo. Puro e sem DOM, testavel a parte.
export const TIMELINE_WINDOW_DAYS = 56;
export const TIMELINE_WEEK_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const PERCENT = 100;
// Barra de um so dia continua visivel.
const MIN_BAR_PCT = 1.5;
const FIRM_CERTAINTIES = ['EXACT', 'APPROXIMATE'];

export interface TimelineRow {
  task: Task;
  leftPct: number;
  widthPct: number;
  overdue: boolean;
  // O prazo cai depois da janela: a barra vai ate ao fim e o resto fica cortado.
  clippedEnd: boolean;
}

export interface TimelineModel {
  windowStart: Date;
  weekStarts: { label: Date; leftPct: number }[];
  rows: TimelineRow[];
}

function startOfDayUtc(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

function dayIndex(iso: string, origin: number): number {
  const d = new Date(iso);
  return Math.floor((startOfDayUtc(d) - origin) / MS_PER_DAY);
}

export function buildTimeline(tasks: Task[], now: Date = new Date()): TimelineModel {
  const origin = startOfDayUtc(now);
  const total = TIMELINE_WINDOW_DAYS;
  const rows: TimelineRow[] = [];

  for (const task of tasks) {
    if (task.progressStatus === 'COMPLETED') continue;
    if (!FIRM_CERTAINTIES.includes(task.dateCertainty)) continue;
    const endDay = dayIndex(task.date, origin);
    const overdue = endDay < 0;
    // Em atraso mostra-se uma barra de um dia no inicio, nao desaparece.
    const rawStart = task.availableFrom ? dayIndex(task.availableFrom, origin) : 0;
    const start = Math.min(Math.max(rawStart, 0), total - 1);
    const end = Math.min(Math.max(endDay, start), total - 1);
    if (!overdue && rawStart >= total) continue;
    const span = end - start + 1;
    rows.push({
      task,
      leftPct: (start / total) * PERCENT,
      widthPct: Math.max((span / total) * PERCENT, MIN_BAR_PCT),
      overdue,
      clippedEnd: endDay >= total,
    });
  }

  rows.sort((a, b) => new Date(a.task.date).getTime() - new Date(b.task.date).getTime());

  const weekStarts: TimelineModel['weekStarts'] = [];
  for (let day = 0; day < total; day += TIMELINE_WEEK_DAYS) {
    weekStarts.push({ label: new Date(origin + day * MS_PER_DAY), leftPct: (day / total) * PERCENT });
  }
  return { windowStart: new Date(origin), weekStarts, rows };
}
