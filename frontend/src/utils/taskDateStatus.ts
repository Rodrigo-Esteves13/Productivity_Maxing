import type { Task } from '../types/models';

export type DateStatus = 'completed' | 'overdue' | 'today' | 'upcoming';

function toDayKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Classifica a task pela data + progressStatus:
// - já concluída (COMPLETED) ganha sempre a essa classificação, mesmo que
//   a data de referência já tenha passado ou ainda esteja para vir;
// - senão, compara a `date` da task com hoje.
export function getDateStatus(task: Task, now: Date = new Date()): DateStatus {
  if (task.progressStatus === 'COMPLETED') return 'completed';

  const taskDate = new Date(task.date);
  const todayKey = toDayKey(now);
  const taskKey = toDayKey(taskDate);

  if (taskKey === todayKey) return 'today';
  return taskDate.getTime() < now.getTime() ? 'overdue' : 'upcoming';
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// Texto curto do tempo que falta (ou já passou) até à due date, para
// complementar o DateStatusBadge (que só diz "Overdue"/"Upcoming", sem
// quantificar quanto). Tasks já concluídas não mostram contagem - já não
// interessa saber "quanto falta" para algo que está feito.
export function getRemainingTimeLabel(task: Task, now: Date = new Date()): string {
  if (task.progressStatus === 'COMPLETED') return '—';

  const diffMs = new Date(task.date).getTime() - now.getTime();
  const absMs = Math.abs(diffMs);

  const days = Math.floor(absMs / DAY_MS);
  const hours = Math.floor((absMs % DAY_MS) / HOUR_MS);

  let amount: string;
  if (days >= 1) {
    amount = `${days}d${hours > 0 ? ` ${hours}h` : ''}`;
  } else if (hours >= 1) {
    amount = `${hours}h`;
  } else {
    amount = '<1h';
  }

  return diffMs < 0 ? `${amount} overdue` : `${amount} left`;
}
