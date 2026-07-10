import StatusBadge from '../UI/StatusBadge';
import DifficultyBadge from '../UI/DifficultyBadge';
import DateStatusBadge from '../UI/DateStatusBadge';
import ColorDot from '../UI/ColorDot';
import RescheduleButton from '../UI/RescheduleButton';
import { getDateStatus, getRemainingTimeLabel } from '../../utils/taskDateStatus';
import { resolveOptionLabel } from '../../utils/resolveOptionLabel';
import type { Task, AcademicTaskTypeOption } from '../../types/models';

interface TaskTableRowProps {
  task: Task;
  academicTaskTypes: AcademicTaskTypeOption[];
  onReschedule?: (e: React.MouseEvent, task: Task) => void;
  isRescheduling?: boolean;
}

export default function TaskTableRow({ 
  task, 
  academicTaskTypes,
  onReschedule,
  isRescheduling = false
}: TaskTableRowProps) {
  const academicTypeLabel = resolveOptionLabel(task.academicType, academicTaskTypes);
  const status = getDateStatus(task);

  return (
    <tr className="border-b border-neutral-800 hover:bg-neutral-800/30 transition-colors">
      <td className="px-4 py-3">{new Date(task.date).toLocaleDateString()}</td>
      <td className="px-4 py-3 text-center flex flex-col items-center justify-center">
        <DateStatusBadge status={status} />
        <div className="text-[11px] text-neutral-500 mt-1 whitespace-nowrap">
          {getRemainingTimeLabel(task)}
        </div>
        {status === 'overdue' && onReschedule && (
          <RescheduleButton 
            isLoading={isRescheduling} 
            onClick={(e) => onReschedule(e, task)} 
          />
        )}
      </td>
      <td className="px-4 py-3 font-medium text-white">
        <div className="flex items-center gap-2">
          {task.area?.colorHex && <ColorDot color={task.area.colorHex} />}
          {task.area?.name || '—'}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="font-medium text-neutral-200">{task.title}</div>
        {task.topics && <div className="text-xs text-neutral-500 mt-0.5">{task.topics}</div>}
      </td>
      <td className="px-4 py-3 text-xs text-neutral-400">{academicTypeLabel}</td>
      <td className="px-4 py-3">{task.weightPercentage ? `${task.weightPercentage}%` : '—'}</td>
      <td className="px-4 py-3"><DifficultyBadge difficulty={task.difficulty} /></td>
      <td className="px-4 py-3 text-center"><StatusBadge status={task.progressStatus} /></td>
      <td className="px-4 py-3 text-center font-medium text-blue-400">{task.targetGrade ?? '—'}</td>
      <td className="px-4 py-3 text-center font-bold text-cyan-400">{task.realGrade ?? '—'}</td>
    </tr>
  );
}