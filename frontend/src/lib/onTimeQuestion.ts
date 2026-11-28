import type { Task } from '../types/models';
import { effectiveDeadlineMs, wasCompletedOnTime } from '../utils/deadlineCompliance';
import { hasFirmDate } from './taskReadiness';
import * as bus from './bus';

// "Acabaste a tempo?" ao concluir uma task depois do prazo: quem apresenta
// no dia e so marca como feito mais tarde nao deve ficar como atrasado.
// Num trabalho em duas fases pergunta-se pela entrega e pela apresentacao.

export type OnTimePhase = 'submission' | 'main';

/** As fases cujo prazo ja passou neste momento (as unicas com duvida). */
export function onTimeQuestions(
  task: Pick<Task, 'date' | 'dateCertainty' | 'submissionDate' | 'academicTypeIsEvent'>,
  now: Date = new Date(),
): OnTimePhase[] {
  // Data por marcar ou surpresa: nao ha prazo para falhar.
  if (!hasFirmDate(task)) return [];
  const phases: OnTimePhase[] = [];
  if (task.submissionDate && now.getTime() > effectiveDeadlineMs({ date: task.submissionDate })) {
    phases.push('submission');
  }
  // Testes e exames (eventos) nunca se "entregam" tarde.
  if (!task.academicTypeIsEvent && now.getTime() > effectiveDeadlineMs(task)) phases.push('main');
  return phases;
}

/** Chamado depois de concluir tasks: abre a pergunta para as que precisam. */
export function askIfFinishedOnTime(tasks: Task[]): void {
  const pending = tasks.filter((task) => onTimeQuestions(task).length > 0);
  if (pending.length > 0) bus.emit('tasks:askOnTime', pending);
}

/**
 * Uma task ja concluida em que a resposta muda alguma coisa: ficou atrasada
 * pelo calculo, ou ja tem resposta (para a poder trocar). As concluidas a
 * tempo e sem resposta nao precisam de pergunta.
 */
export function canReviewOnTime(task: Task, now: Date = new Date()): boolean {
  if (task.progressStatus !== 'COMPLETED' || onTimeQuestions(task, now).length === 0) return false;
  const answered = task.onTime != null || task.submissionOnTime != null;
  return answered || wasCompletedOnTime(task) === false;
}
