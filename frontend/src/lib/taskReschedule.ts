import type { Task } from '../types/models';
import { hasFirmDate } from './taskReadiness';

// Aplica localmente o que PATCH /tasks/bulk-reschedule grava (mesma regra de
// backend/src/tasks/bulk-reschedule.util.ts), para nao voltar a pedir a lista:
// concluidas nao mexem, so adiar um prazo real conta como adiamento e a
// entrega nunca fica depois da data nova. `date` em ISO.
export function applyBulkReschedule(tasks: Task[], ids: ReadonlySet<string>, date: string): Task[] {
  const target = new Date(date).getTime();
  return tasks.map((task) => {
    if (!ids.has(task.id) || task.progressStatus === 'COMPLETED') return task;
    const postponed = hasFirmDate(task) && new Date(task.date).getTime() < target;
    const handInAfter = !!task.submissionDate && new Date(task.submissionDate).getTime() > target;
    return {
      ...task,
      date,
      postponedCount: task.postponedCount + (postponed ? 1 : 0),
      ...(handInAfter ? { submissionDate: date } : {}),
    };
  });
}
