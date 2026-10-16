// Uma bolinha por task avaliada: foco medio das sessoes dos dias antes do
// prazo (eixo X) contra a nota (eixo Y). Ao contrario do grafico semanal,
// ancora o estudo a cada teste em vez de misturar semanas. Funcoes puras.
import { MS_PER_DAY } from '../common/time.constants';
import { roundTo } from '../common/round.util';

// Dias antes do prazo cujas sessoes contam para o foco de uma task.
export const SCATTER_WINDOW_DAYS = 14;
// Maximo de bolinhas devolvidas (as tasks mais recentes).
export const SCATTER_MAX_POINTS = 60;

const FULL_PERCENT = 100;
const DECIMALS = 1;

export interface ScatterTask {
  id: string;
  title: string;
  areaId: string;
  areaName: string;
  // Prazo: o estudo conta ate aqui.
  date: Date;
  // Nota normalizada 0..1 na escala do curso.
  fraction: number;
}

export interface ScatterSession {
  taskId: string | null;
  areaId: string | null;
  startedAt: Date;
  minutes: number;
  focus: number | null;
}

export interface ScatterPoint {
  taskId: string;
  title: string;
  areaName: string;
  // Prazo da task, "YYYY-MM-DD".
  date: string;
  avgFocus: number;
  ratedMinutes: number;
  gradePercent: number;
}

/**
 * Uma sessao conta para a task se for dela (taskId) ou da mesma cadeira
 * (areaId) nos SCATTER_WINDOW_DAYS dias ate ao prazo. Tasks sem nenhuma
 * sessao classificada nessa janela ficam de fora.
 */
export function buildFocusScatter(
  tasks: ScatterTask[],
  sessions: ScatterSession[],
): ScatterPoint[] {
  const rated = sessions.filter((s) => s.focus !== null && s.minutes > 0);

  const points: ScatterPoint[] = [];
  for (const task of tasks) {
    const windowEnd = task.date.getTime();
    const windowStart = windowEnd - SCATTER_WINDOW_DAYS * MS_PER_DAY;

    let ratedMinutes = 0;
    let focusMinutes = 0;
    for (const session of rated) {
      const at = session.startedAt.getTime();
      if (at < windowStart || at > windowEnd) continue;
      if (session.taskId !== task.id && session.areaId !== task.areaId)
        continue;
      ratedMinutes += session.minutes;
      focusMinutes += session.minutes * (session.focus as number);
    }
    if (ratedMinutes <= 0) continue;

    points.push({
      taskId: task.id,
      title: task.title,
      areaName: task.areaName,
      date: task.date.toISOString().slice(0, 'YYYY-MM-DD'.length),
      avgFocus: roundTo(focusMinutes / ratedMinutes, DECIMALS),
      ratedMinutes: Math.round(ratedMinutes),
      gradePercent: roundTo(task.fraction * FULL_PERCENT, DECIMALS),
    });
  }

  return points
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, SCATTER_MAX_POINTS);
}
