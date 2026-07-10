import TaskCard from './TaskCard';
import type { Task } from '../../types/models';

interface TaskGridProps {
  tasks: Task[];
  onSelect: (task: Task) => void;
  onReschedule?: (e: React.MouseEvent, task: Task) => void;
  reschedulingId?: string | null;
}

export default function TaskGrid({ 
  tasks, 
  onSelect, 
  onReschedule, 
  reschedulingId 
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
        />
      ))}
    </div>
  );
}