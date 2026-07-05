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
