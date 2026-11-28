import type { Task } from '../types/models';
import { getDateStatus, type DateStatus } from '../utils/taskDateStatus';
import { formatHandIn, formatTaskDue } from './taskReadiness';

export interface TaskPresentation {
  status: DateStatus;
  isOverdue: boolean;
  // Prazo ja formatado na lingua pedida.
  due: string;
  // Entrega (tasks em duas fases), ou null.
  handIn: string | null;
  // Peso na nota ("20%"), ou "N/A".
  weight: string;
}

// O que os cartoes, o quadro e a linha da tabela mostram da mesma task.
export function getTaskPresentation(task: Task, lang?: string, now?: Date): TaskPresentation {
  const status = getDateStatus(task, now);
  return {
    status,
    isOverdue: status === 'overdue',
    due: formatTaskDue(task, lang),
    handIn: formatHandIn(task, lang),
    weight: task.weightPercentage ? `${task.weightPercentage}%` : 'N/A',
  };
}

interface SwipeHandlers {
  onComplete?: (task: Task) => void;
  onReschedule?: (e: React.MouseEvent | null, task: Task) => void;
}

// Swipe dos cartoes: a direita conclui (se ainda estiver aberta), a esquerda
// passa para amanha (so em atraso, como o botao +1 Day).
export function getSwipeActions(task: Task, isOverdue: boolean, { onComplete, onReschedule }: SwipeHandlers) {
  return {
    onSwipeRight:
      onComplete && task.progressStatus !== 'COMPLETED' ? () => onComplete(task) : undefined,
    onSwipeLeft: onReschedule && isOverdue ? () => onReschedule(null, task) : undefined,
  };
}
