// Uma bolinha por task avaliada: foco medio das sessoes que lhe pertencem
// (eixo X) contra a nota (eixo Y). As sessoes chegam ja atribuidas a cada
// task (session-attribution.util.ts), as mesmas que o modelo do efeito do
// foco usa. Funcoes puras.
import { roundTo } from '../common/round.util';

// Maximo de bolinhas devolvidas (as tasks mais recentes).
export const SCATTER_MAX_POINTS = 60;

const FULL_PERCENT = 100;
const DECIMALS = 1;

export interface ScatterTask {
  id: string;
  title: string;
  areaName: string;
  // Prazo da task.
  date: Date;
  // Nota normalizada 0..1 na escala do curso.
  fraction: number;
  // Sessoes desta task (ligadas a ela ou da cadeira antes do prazo).
  sessions: { minutes: number; focus: number | null }[];
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

/** Tasks sem nenhuma sessao classificada ficam de fora (nao ha foco a mostrar). */
export function buildFocusScatter(tasks: ScatterTask[]): ScatterPoint[] {
  const points: ScatterPoint[] = [];
  for (const task of tasks) {
    let ratedMinutes = 0;
    let focusMinutes = 0;
    for (const session of task.sessions) {
      if (session.focus === null || session.minutes <= 0) continue;
      ratedMinutes += session.minutes;
      focusMinutes += session.minutes * session.focus;
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
