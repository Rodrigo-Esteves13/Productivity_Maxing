import TaskCard from './TaskCard';
import type { Task, Area } from '../../types/models';

interface TaskGridProps {
  tasks: Task[];
  onSelect: (task: Task) => void;
  onReschedule?: (e: React.MouseEvent, task: Task) => void;
  reschedulingId?: string | null;
  areas?: Area[];
  onMoveArea?: (task: Task, areaId: string) => void;
  onTogglePin?: (task: Task) => void;
}

export default function TaskGrid({ 
  tasks, 
  onSelect, 
  onReschedule, 
  reschedulingId,
  areas,
  onMoveArea,
  onTogglePin,
}: TaskGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {tasks.map((task) => (
        <TaskCard 
          key={task.id} 
          task={task} 
          onSelect={onSelect} 
          onReschedule={onReschedule}
          isRescheduling={reschedulingId === task.id}
          areas={areas}
          onMoveArea={onMoveArea}
          onTogglePin={onTogglePin}
        />
      ))}
    </div>
  );
}