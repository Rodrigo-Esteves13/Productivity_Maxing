import TaskCard from './TaskCard';
import type { Task } from '../../types/models';

interface TaskGridProps {
  tasks: Task[];
  onSelect: (task: Task) => void;
}

export default function TaskGrid({ tasks, onSelect }: TaskGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {tasks.map((task) => (
        <TaskCard key={task.id} task={task} onSelect={onSelect} />
      ))}
    </div>
  );
}
