import type { Task } from '../types/models';
import { MS_PER_HOUR, MS_PER_DAY } from '../lib/timeConstants';
import { isUtcMidnight, toDateKey } from '../lib/dateKey';
import { translateNow } from '../i18n/translate';

export type DateStatus = 'completed' | 'overdue' | 'today' | 'upcoming';

// Classifies the task by date + progressStatus:
// - already completed (COMPLETED) always wins that classification, even if
//   the reference date has already passed or is still upcoming;
// - otherwise, compares the task's `date` to today.
export function getDateStatus(task: Task, now: Date = new Date()): DateStatus {
  if (task.progressStatus === 'COMPLETED') return 'completed';

  const taskDate = new Date(task.date);
  const todayKey = toDateKey(now);
  const taskKey = toDateKey(taskDate);

  if (taskKey === todayKey) return 'today';
  return taskDate.getTime() < now.getTime() ? 'overdue' : 'upcoming';
}


// Prazo real de uma task. As tasks sem hora (o formulario so tem data) ficam
// guardadas a meia-noite UTC desse dia, e o prazo e o FIM desse dia. Contar
// ate a meia-noite em si mostrava "1h left" as 23h da vespera de um teste e
// "overdue" durante o proprio dia, ao contrario do getDateStatus ("today").
export function getDeadlineMs(task: Pick<Task, 'date'>): number {
  const date = new Date(task.date);
  return isUtcMidnight(date) ? date.getTime() + MS_PER_DAY : date.getTime();
}

// Short text for the time remaining (or already elapsed) until the due
// date, to complement DateStatusBadge (which only says "Overdue"/"Upcoming",
// without quantifying how much). Completed tasks don't show a count -
// "how much is left" no longer matters for something that's done.
export function getRemainingTimeLabel(task: Task, now: Date = new Date()): string {
  if (task.progressStatus === 'COMPLETED') return 'N/A';

  const diffMs = getDeadlineMs(task) - now.getTime();
  const absMs = Math.abs(diffMs);

  const days = Math.floor(absMs / MS_PER_DAY);
  const hours = Math.floor((absMs % MS_PER_DAY) / MS_PER_HOUR);

  // Unidades e frase na lingua da app ("3d 4h left", "剩余 3天4小时").
  let amount: string;
  if (days >= 1) {
    amount = hours > 0 ? translateNow('time.daysHours', { days, hours }) : translateNow('time.days', { days });
  } else if (hours >= 1) {
    amount = translateNow('time.hours', { hours });
  } else {
    amount = translateNow('time.underHour');
  }

  return translateNow(diffMs < 0 ? 'time.overdue' : 'time.left', { amount });
}
