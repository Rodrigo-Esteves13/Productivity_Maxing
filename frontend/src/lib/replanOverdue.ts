import type { Task } from '../types/models';
import { hasFirmDate, isLocked } from './taskReadiness';
import { taskDayKey, todayKey } from './dateKey';

// "Replanear atrasadas": espalha as tasks em atraso pelos dias mais livres
// dos proximos dias, em vez de as empilhar hoje. Puro e sem rede.
export const REPLAN_SPAN_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface ReplanMove {
  task: Task;
  // "YYYY-MM-DD" do novo dia.
  date: string;
}

function addDays(key: string, days: number): string {
  return new Date(new Date(`${key}T00:00:00Z`).getTime() + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Abertas, com prazo real, ja desbloqueadas e com o dia antes de hoje. */
export function overdueTasks(tasks: readonly Task[], now: Date = new Date()): Task[] {
  const today = todayKey(now);
  return tasks
    .filter(
      (task) =>
        task.progressStatus !== 'COMPLETED' &&
        hasFirmDate(task) &&
        !isLocked(task, now) &&
        taskDayKey(new Date(task.date)) < today,
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Atribui cada atrasada ao dia (de hoje a hoje + REPLAN_SPAN_DAYS - 1) com
 * menos tasks; empate resolve-se pelo dia mais cedo. A carga de cada dia
 * inclui as ja agendadas e as que este plano vai pondo la.
 */
export function planReplan(tasks: readonly Task[], now: Date = new Date()): ReplanMove[] {
  const overdue = overdueTasks(tasks, now);
  if (overdue.length === 0) return [];
  const today = todayKey(now);
  const days = Array.from({ length: REPLAN_SPAN_DAYS }, (_, i) => addDays(today, i));
  const load = new Map<string, number>(days.map((day) => [day, 0]));
  const overdueIds = new Set(overdue.map((task) => task.id));
  for (const task of tasks) {
    if (task.progressStatus === 'COMPLETED' || overdueIds.has(task.id) || !hasFirmDate(task)) continue;
    const key = taskDayKey(new Date(task.date));
    if (load.has(key)) load.set(key, (load.get(key) ?? 0) + 1);
  }
  return overdue.map((task) => {
    let best = days[0];
    for (const day of days) if ((load.get(day) ?? 0) < (load.get(best) ?? 0)) best = day;
    load.set(best, (load.get(best) ?? 0) + 1);
    return { task, date: best };
  });
}
