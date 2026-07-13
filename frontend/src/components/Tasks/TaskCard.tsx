import type { KeyboardEvent } from 'react';
import type { Task } from '../../types/models';
import StatusBadge from '../UI/StatusBadge';
import DifficultyBadge from '../UI/DifficultyBadge';
import RescheduleButton from '../UI/RescheduleButton';
import { getDateStatus } from '../../utils/taskDateStatus';

interface TaskCardProps {
  task: Task;
  onSelect?: (task: Task) => void;
  onReschedule?: (e: React.MouseEvent, task: Task) => void;
  isRescheduling?: boolean;
}

export default function TaskCard({ 
  task, 
  onSelect,
  onReschedule,
  isRescheduling = false 
}: TaskCardProps) {
  const areaName = task.area?.name || 'No Area';
  const isInteractive = Boolean(onSelect);
  const status = getDateStatus(task);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!onSelect) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(task);
    }
  };

  return (
    <div
      onClick={() => onSelect?.(task)}
      onKeyDown={handleKeyDown}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      // h-full garante que todos os cards de uma linha da grelha ficam com a
      // mesma altura (a grelha já estica a linha para o mais alto - isto só
      // faz o cartão em si preencher esse espaço), para o rodapé (mt-auto)
      // ficar sempre à mesma altura entre cards, seja qual for o conteúdo.
      className={`relative flex flex-col h-full p-4 bg-neutral-900/50 border border-neutral-800 rounded-xl hover:border-violet-500/50 transition-colors ${
        isInteractive ? 'cursor-pointer' : ''
      }`}
    >
      {/* Cabeçalho só com o status - a dificuldade voltou para o rodapé.
          Com 2 badges aqui, títulos longos ficavam a lutar por espaço e
          quebravam de forma inconsistente entre cards. Com só 1 badge,
          o título tem sempre a largura que precisa. */}
      <div className="flex justify-between items-start mb-3 gap-3">
        <h3 className="text-lg font-medium text-white line-clamp-2 min-w-0">{task.title}</h3>
        <div className="flex-shrink-0">
          <StatusBadge status={task.progressStatus} />
        </div>
      </div>

      {/* mt-auto empurra esta secção para o fundo, para os rodapés ficarem
          sempre à mesma altura entre cards independentemente do título.
          Duas linhas fixas em vez de uma só - assim cada uma tem sempre
          espaço de sobra e nada disputa largura com o +1 Day. */}
      <div className="mt-auto pt-2 text-xs text-neutral-400 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 bg-neutral-800 rounded-md font-medium text-neutral-300 truncate max-w-[10rem]">
            {areaName}
          </span>
          <span>•</span>
          <span className={status === 'overdue' ? 'text-red-400 font-medium whitespace-nowrap' : 'whitespace-nowrap'}>
            {new Date(task.date).toLocaleDateString()}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <DifficultyBadge difficulty={task.difficulty} />
          {status === 'overdue' && onReschedule && (
            <RescheduleButton
              isLoading={isRescheduling}
              onClick={(e) => onReschedule(e, task)}
            />
          )}
        </div>
      </div>
    </div>
  );
}