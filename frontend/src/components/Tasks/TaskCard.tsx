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
      // Adicionado flex flex-col para garantir alinhamento perfeito na grelha
      className={`relative flex flex-col p-4 bg-neutral-900/50 border border-neutral-800 rounded-xl hover:border-violet-500/50 transition-colors ${
        isInteractive ? 'cursor-pointer' : 'h-full'
      }`}
    >
      {/* Cabeçalho limpo, com gap-3 e min-w-0 para o título truncar bem sem esmagar o badge */}
      <div className="flex justify-between items-start mb-3 gap-3">
        <h3 className="text-lg font-medium text-white line-clamp-2 min-w-0">{task.title}</h3>
        <div className="flex-shrink-0">
          <StatusBadge status={task.progressStatus} />
        </div>
      </div>

      {/* mt-auto empurra esta secção para o fundo. Assim, mesmo que um título tenha 1 linha e outro 2, os rodapés ficam sempre alinhados horizontalmente! */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400 mt-auto pt-2">
        <span className="px-2 py-1 bg-neutral-800 rounded-md font-medium text-neutral-300">
          {areaName}
        </span>
        <span>•</span>
        
        {/* A data fica vermelha se estiver atrasada */}
        <span className={status === 'overdue' ? 'text-red-400 font-medium' : ''}>
          {new Date(task.date).toLocaleDateString()}
        </span>
        
        <span>•</span>
        <DifficultyBadge difficulty={task.difficulty} />

        {/* O botão aparece no fim, organicamente contextualizado. 
            O -mt-1 anula a margem padrão do componente para alinhar verticalmente com o texto */}
        {status === 'overdue' && onReschedule && (
          <>
            <span>•</span>
            <div className="-mt-1">
              <RescheduleButton 
                isLoading={isRescheduling} 
                onClick={(e) => onReschedule(e, task)} 
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}