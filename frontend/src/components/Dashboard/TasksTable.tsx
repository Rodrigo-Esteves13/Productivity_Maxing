import TasksTableHeader from './TasksTableHeader';
import TaskTableRow from './TaskTableRow';
import type { Task, AcademicTaskTypeOption } from '../../types/models';

interface TasksTableProps {
  tasks: Task[];
  academicTaskTypes: AcademicTaskTypeOption[];
}

export default function TasksTable({ tasks, academicTaskTypes }: TasksTableProps) {
  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl overflow-hidden shadow-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-neutral-300 whitespace-nowrap">
          <TasksTableHeader />
          <tbody>
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-neutral-500">
                  Nenhuma tarefa encontrada.
                </td>
              </tr>
            ) : (
              tasks.map((task) => (
                <TaskTableRow key={task.id} task={task} academicTaskTypes={academicTaskTypes} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
