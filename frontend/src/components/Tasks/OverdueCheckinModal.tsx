import type { Task } from '../../types/models';
import { getRemainingTimeLabel } from '../../utils/taskDateStatus';

interface OverdueCheckinModalProps {
  task: Task;
  queueLength: number;
  isAnswering: boolean;
  onAnswer: (isCompleted: boolean) => void;
}

// Prompt diário para tasks já fora de prazo: pergunta diretamente se já
// está feita, para não depender de o utilizador se lembrar de marcar cada
// task manualmente. Deliberadamente não tem X nem fecha com Escape/clique
// no fundo - responder é a única saída, senão o objetivo da feature
// (garantir que perguntamos mesmo) fica fácil de ignorar.
export default function OverdueCheckinModal({
  task,
  queueLength,
  isAnswering,
  onAnswer,
}: OverdueCheckinModalProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-5 border-b border-neutral-800 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Overdue check-in</h2>
          {queueLength > 1 && (
            <span className="text-xs font-medium text-neutral-500">
              1 of {queueLength}
            </span>
          )}
        </div>

        <div className="p-5">
          <p className="text-sm text-neutral-400 mb-1">This task is past its due date:</p>
          <p className="text-white font-semibold mb-2">{task.title}</p>
          <p className="text-sm text-red-400 mb-5">{getRemainingTimeLabel(task)}</p>

          <p className="text-neutral-200 font-medium mb-4">Is it actually done?</p>

          <div className="flex gap-3">
            <button
              type="button"
              disabled={isAnswering}
              onClick={() => onAnswer(true)}
              className="flex-1 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold transition-colors"
            >
              Yes, mark as done
            </button>
            <button
              type="button"
              disabled={isAnswering}
              onClick={() => onAnswer(false)}
              className="flex-1 py-2.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed text-neutral-200 font-semibold transition-colors border border-neutral-700"
            >
              No, still pending
            </button>
          </div>

          <p className="text-xs text-neutral-500 mt-4">
            We'll ask again tomorrow if it's still not marked as done.
          </p>
        </div>
      </div>
    </div>
  );
}
