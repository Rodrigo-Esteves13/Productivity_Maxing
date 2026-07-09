import TasksTableHeader from './TasksTableHeader';
import TaskTableRow from './TaskTableRow';
import TaskCard from './TaskCard';
import type { Task, AcademicTaskTypeOption } from '../../types/models';

interface TasksTableProps {
  tasks: Task[];
  academicTaskTypes: AcademicTaskTypeOption[];
}

export default function TasksTable({ tasks, academicTaskTypes }: TasksTableProps) {
  if (tasks.length === 0) {
    return (
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl overflow-hidden shadow-xl">
        <div className="px-4 py-8 text-center text-neutral-500">Nenhuma tarefa encontrada.</div>
      </div>
    );
  }

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl overflow-hidden shadow-xl">
      {/* Mobile (<sm): cartões empilhados - uma tabela com scroll horizontal
          era ilegível em ecrãs pequenos (muitas colunas, texto minúsculo). */}
      <div className="sm:hidden">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} academicTaskTypes={academicTaskTypes} />
        ))}
      </div>

      {/* Desktop/tablet (sm+): tabela completa, como antes. */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm text-left text-neutral-300 whitespace-nowrap">
          <TasksTableHeader />
          <tbody>
            {tasks.map((task) => (
              <TaskTableRow key={task.id} task={task} academicTaskTypes={academicTaskTypes} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
