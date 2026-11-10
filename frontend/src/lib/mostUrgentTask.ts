import type { Task } from '../types/models';
import { getDateStatus, getDeadlineMs } from '../utils/taskDateStatus';
import { hasFirmDate, isLocked } from './taskReadiness';

const COMPLETED_STATUS = 'COMPLETED';

// Sem prioridade ou sem peso: vai para o fim da respetiva comparacao.
const NO_PRIORITY_RANK = Number.MAX_SAFE_INTEGER;
const NO_WEIGHT = 0;

// Ordem de urgencia: em atraso primeiro, depois o prazo firme mais proximo
// (sem prazo firme no fim), depois maior prioridade (priorityOrder menor),
// depois maior peso, e por fim o titulo.
function compareUrgency(a: Task, b: Task, now: Date): number {
  const aOverdue = getDateStatus(a, now) === 'overdue';
  const bOverdue = getDateStatus(b, now) === 'overdue';
  if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;

  const aFirm = hasFirmDate(a);
  const bFirm = hasFirmDate(b);
  if (aFirm !== bFirm) return aFirm ? -1 : 1;
  if (aFirm && bFirm) {
    const byDeadline = getDeadlineMs(a) - getDeadlineMs(b);
    if (byDeadline !== 0) return byDeadline;
  }

  const byPriority = (a.priorityOrder ?? NO_PRIORITY_RANK) - (b.priorityOrder ?? NO_PRIORITY_RANK);
  if (byPriority !== 0) return byPriority;

  const byWeight = (b.weightPercentage ?? NO_WEIGHT) - (a.weightPercentage ?? NO_WEIGHT);
  if (byWeight !== 0) return byWeight;

  return a.title.localeCompare(b.title);
}

/** A task aberta (nao concluida, nao bloqueada) mais urgente, ou null. */
export function mostUrgentTask(tasks: readonly Task[], now: Date = new Date()): Task | null {
  let best: Task | null = null;
  for (const task of tasks) {
    if (task.progressStatus === COMPLETED_STATUS || isLocked(task, now)) continue;
    if (best === null || compareUrgency(task, best, now) < 0) best = task;
  }
  return best;
}
