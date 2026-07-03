import type { Task } from '../../types/models';
import StatusBadge from '../UI/StatusBadge';
import DifficultyBadge from '../UI/DifficultyBadge';

interface TaskCardProps {
  task: Task;
}

export default function TaskCard({ task }: TaskCardProps) {
  const areaName = task.area?.name || 'Sem Área';

  return (
    <div className="p-4 bg-neutral-900/50 border border-neutral-800 rounded-xl hover:border-violet-500/50 transition-colors">
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
        
        {/* 2. Substitui o texto pelo Badge! */}
        <DifficultyBadge difficulty={task.difficulty} />
      </div>
    </div>
  );
}