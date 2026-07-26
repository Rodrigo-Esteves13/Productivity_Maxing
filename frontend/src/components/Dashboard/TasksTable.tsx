import TasksTableHeader from './TasksTableHeader';
import TaskTableRow from './TaskTableRow';
import TaskCard from './TaskCard';
import type { Task, AcademicTaskTypeOption } from '../../types/models';

interface TasksTableProps {
  tasks: Task[];
  academicTaskTypes: AcademicTaskTypeOption[];
  onReschedule?: (e: React.MouseEvent, task: Task) => void;
  reschedulingId?: string | null;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: () => void;
}

export default function TasksTable({ 
  tasks, 
  academicTaskTypes,
  onReschedule,
  reschedulingId,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
}: TasksTableProps) {
  if (tasks.length === 0) {
    return (
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl overflow-hidden shadow-xl">
        <div className="px-4 py-8 text-center text-neutral-500">No tasks found.</div>
      </div>
    );
  }

  const allSelected = tasks.length > 0 && tasks.every((t) => selectedIds?.has(t.id));

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl overflow-hidden shadow-xl">
      <div className="sm:hidden">
        {tasks.map((task) => (
          <TaskCard 
            key={task.id} 
            task={task} 
            academicTaskTypes={academicTaskTypes} 
            onReschedule={onReschedule}
            isRescheduling={reschedulingId === task.id}
            isSelected={selectedIds?.has(task.id)}
            onToggleSelect={onToggleSelect}
          />
        ))}
      </div>

      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm text-left text-neutral-300">
          <TasksTableHeader allSelected={allSelected} onToggleAll={onToggleSelectAll} />
          <tbody>
            {tasks.map((task) => (
              <TaskTableRow 
                key={task.id} 
                task={task} 
                academicTaskTypes={academicTaskTypes} 
                onReschedule={onReschedule}
                isRescheduling={reschedulingId === task.id}
                isSelected={selectedIds?.has(task.id)}
                onToggleSelect={onToggleSelect}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}