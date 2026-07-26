import StatusBadge from '../UI/StatusBadge';
import DifficultyBadge from '../UI/DifficultyBadge';
import DateStatusBadge from '../UI/DateStatusBadge';
import ColorDot from '../UI/ColorDot';
import RescheduleButton from '../UI/RescheduleButton';
import CalendarSyncButton from './CalendarSyncButton';
import { getDateStatus, getRemainingTimeLabel } from '../../utils/taskDateStatus';
import { resolveOptionLabel } from '../../utils/resolveOptionLabel';
import type { Task, AcademicTaskTypeOption } from '../../types/models';

interface TaskTableRowProps {
  task: Task;
  academicTaskTypes: AcademicTaskTypeOption[];
  onReschedule?: (e: React.MouseEvent, task: Task) => void;
  isRescheduling?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
}

export default function TaskTableRow({
  task,
  academicTaskTypes,
  onReschedule,
  isRescheduling = false,
  isSelected,
  onToggleSelect,
}: TaskTableRowProps) {
  const academicTypeLabel = resolveOptionLabel(task.academicType, academicTaskTypes);
  const status = getDateStatus(task);

  return (
    <tr className="border-b border-neutral-800 hover:bg-neutral-800/30 transition-colors">
      {onToggleSelect && (
        <td className="px-4 py-3 align-middle print-hide" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={!!isSelected}
            onChange={() => onToggleSelect(task.id)}
            className="accent-violet-500"
            aria-label={`Select task ${task.title}`}
          />
        </td>
      )}
      <td className="px-4 py-3 align-middle">
        <div>{new Date(task.date).toLocaleDateString()}</div>
        <div className="mt-1 flex flex-col items-start gap-1">
          <span className="-ml-0.5">
            <DateStatusBadge status={status} />
          </span>
          <span className="text-[11px] text-neutral-500 whitespace-nowrap">
            {getRemainingTimeLabel(task)}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 align-middle font-medium text-white">
        <div className="flex items-center gap-2">
          {task.area?.colorHex && <ColorDot color={task.area.colorHex} />}
          <span className="truncate max-w-[10rem]">{task.area?.name || 'N/A'}</span>
        </div>
      </td>
      <td className="px-4 py-3 align-middle">
        <div className="font-medium text-neutral-200">{task.title}</div>
        {task.topics && <div className="text-xs text-neutral-500 mt-0.5">{task.topics}</div>}
      </td>
      <td className="px-4 py-3 align-middle text-xs text-neutral-400">
        <div>{academicTypeLabel || 'N/A'}</div>
        <div className="mt-0.5">{task.weightPercentage ? `${task.weightPercentage}%` : 'N/A'}</div>
      </td>
      <td className="px-4 py-3 align-middle"><DifficultyBadge difficulty={task.difficulty} /></td>
      <td className="px-4 py-3 align-middle text-center"><StatusBadge status={task.progressStatus} /></td>
      <td className="px-4 py-3 align-middle text-center text-xs">
        <span className="font-medium text-blue-400">{task.targetGrade ?? 'N/A'}</span>
        <span className="text-neutral-600"> / </span>
        <span className="font-bold text-cyan-400">{task.realGrade ?? 'N/A'}</span>
      </td>
      <td className="px-4 py-3 align-middle text-center" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col items-center gap-1">
          <CalendarSyncButton task={task} />
          {status === 'overdue' && onReschedule && (
            <RescheduleButton
              isLoading={isRescheduling}
              onClick={(e) => onReschedule(e, task)}
            />
          )}
        </div>
      </td>
    </tr>
  );
}