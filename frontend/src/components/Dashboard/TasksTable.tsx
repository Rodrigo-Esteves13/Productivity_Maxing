import TasksTableHeader from './TasksTableHeader';
import TaskTableRow from './TaskTableRow';
import TaskCard from './TaskCard';
import type { Task, AcademicTaskTypeOption } from '../../types/models';

interface TasksTableProps {
  tasks: Task[];
  academicTaskTypes: AcademicTaskTypeOption[];
  onReschedule?: (e: React.MouseEvent, task: Task) => void;
  reschedulingId?: string | null;
}

export default function TasksTable({ 
  tasks, 
  academicTaskTypes,
  onReschedule,
  reschedulingId 
}: TasksTableProps) {
  if (tasks.length === 0) {
    return (
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl overflow-hidden shadow-xl">
        <div className="px-4 py-8 text-center text-neutral-500">Nenhuma tarefa encontrada.</div>
      </div>
    );
  }

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
          />
        ))}
      </div>

      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm text-left text-neutral-300 whitespace-nowrap">
          <TasksTableHeader />
          <tbody>
            {tasks.map((task) => (
              <TaskTableRow 
                key={task.id} 
                task={task} 
                academicTaskTypes={academicTaskTypes} 
                onReschedule={onReschedule}
                isRescheduling={reschedulingId === task.id}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}