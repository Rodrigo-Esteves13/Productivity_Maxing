import StatusBadge from '../UI/StatusBadge';
import DifficultyBadge from '../UI/DifficultyBadge';
import DateStatusBadge from '../UI/DateStatusBadge';
import ColorDot from '../UI/ColorDot';
import RescheduleButton from '../UI/RescheduleButton';
import CalendarSyncButton from './CalendarSyncButton';
import { getDateStatus, getRemainingTimeLabel } from '../../utils/taskDateStatus';
import { resolveOptionLabel } from '../../utils/resolveOptionLabel';
import type { Task, AcademicTaskTypeOption } from '../../types/models';

interface TaskCardProps {
  task: Task;
  academicTaskTypes: AcademicTaskTypeOption[];
  // Novas props adicionadas aqui!
  onReschedule?: (e: React.MouseEvent, task: Task) => void;
  isRescheduling?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
}

export default function TaskCard({
  task,
  academicTaskTypes,
  onReschedule,
  isRescheduling = false,
  isSelected,
  onToggleSelect,
}: TaskCardProps) {
  const academicTypeLabel = resolveOptionLabel(task.academicType, academicTaskTypes);
  const status = getDateStatus(task);

  return (
    <div className="border-b border-neutral-800 p-4 last:border-b-0">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex items-start gap-2">
          {onToggleSelect && (
            <input
              type="checkbox"
              checked={!!isSelected}
              onChange={() => onToggleSelect(task.id)}
              className="accent-violet-500 print-hide mt-1"
              aria-label={`Select task ${task.title}`}
            />
          )}
          <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-medium text-white">
            {task.area?.colorHex && <ColorDot color={task.area.colorHex} />}
            <span className="truncate">{task.area?.name || 'N/A'}</span>
          </div>
          <div className="font-medium text-neutral-100 mt-1 break-words">{task.title}</div>
          {task.topics && <div className="text-xs text-neutral-500 mt-0.5 break-words">{task.topics}</div>}
          </div>
        </div>
        <div className="flex-shrink-0 text-right flex flex-col items-end">
          <DateStatusBadge status={status} />
          <span className="text-[11px] text-neutral-500 mt-1 whitespace-nowrap">
            {getRemainingTimeLabel(task)}
          </span>
        </div>
      </div>

      {/* Linha 1: badges informativos, podem dar wrap livremente sem afetar mais nada */}
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <DifficultyBadge difficulty={task.difficulty} />
        <StatusBadge status={task.progressStatus} />
        <span className="text-[11px] text-neutral-400">{academicTypeLabel}</span>
      </div>

      {/* Linha 2: ações (Sync à esquerda, Reschedule à direita) — linha própria e fixa,
          nunca mistura com os badges acima, por isso nunca fica "+1 Day" órfão a meio de um wrap */}
      <div className="flex items-center gap-2 mt-2">
        <CalendarSyncButton task={task} />
        {status === 'overdue' && onReschedule && (
          <RescheduleButton
            isLoading={isRescheduling}
            onClick={(e) => onReschedule(e, task)}
            className="ml-auto"
          />
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-neutral-800/70 text-center">
        <div>
          <div className="text-[10px] uppercase text-neutral-500">Date</div>
          <div className="text-xs text-neutral-300 mt-0.5">{new Date(task.date).toLocaleDateString()}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-neutral-500">Weight</div>
          <div className="text-xs text-neutral-300 mt-0.5">
            {task.weightPercentage ? `${task.weightPercentage}%` : 'N/A'}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-neutral-500">Target / Real</div>
          <div className="text-xs mt-0.5">
            <span className="font-medium text-blue-400">{task.targetGrade ?? 'N/A'}</span>
            <span className="text-neutral-600"> / </span>
            <span className="font-bold text-cyan-400">{task.realGrade ?? 'N/A'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}