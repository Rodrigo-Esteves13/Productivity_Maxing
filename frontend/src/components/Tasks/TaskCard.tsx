import type { KeyboardEvent } from 'react';
import type { Task } from '../../types/models';
import StatusBadge from '../UI/StatusBadge';
import DifficultyBadge from '../UI/DifficultyBadge';

interface TaskCardProps {
  task: Task;
  onSelect?: (task: Task) => void;
}

export default function TaskCard({ task, onSelect }: TaskCardProps) {
  const areaName = task.area?.name || 'Sem Área';
  const isInteractive = Boolean(onSelect);

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
      className={`p-4 bg-neutral-900/50 border border-neutral-800 rounded-xl hover:border-violet-500/50 transition-colors ${
        isInteractive ? 'cursor-pointer' : ''
      }`}
    >
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-lg font-medium text-white line-clamp-2">{task.title}</h3>
        <StatusBadge status={task.progressStatus} />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400">
        <span className="px-2 py-1 bg-neutral-800 rounded-md font-medium text-neutral-300">
          {areaName}
        </span>
        <span>•</span>
        <span>{new Date(task.date).toLocaleDateString()}</span>
        <span>•</span>

        <DifficultyBadge difficulty={task.difficulty} />
      </div>
    </div>
  );
}
