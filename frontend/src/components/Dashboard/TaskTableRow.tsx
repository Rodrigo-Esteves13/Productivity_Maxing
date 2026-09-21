import type { ReactNode } from 'react';
import StatusBadge from '../UI/StatusBadge';
import DifficultyBadge from '../UI/DifficultyBadge';
import PriorityBadge from '../UI/PriorityBadge';
import PostponedIndicator from '../UI/PostponedIndicator';
import DateStatusBadge from '../UI/DateStatusBadge';
import ColorDot from '../UI/ColorDot';
import RescheduleButton from '../UI/RescheduleButton';
import CalendarSyncButton from './CalendarSyncButton';
import { getDateStatus, getRemainingTimeLabel } from '../../utils/taskDateStatus';
import { resolveOptionLabel } from '../../utils/resolveOptionLabel';
import type { Task, AcademicTaskTypeOption } from '../../types/models';
import type { TableDensity } from '../../hooks/useTableDensity';
import type { TasksTableColumnId } from '../../lib/tasksTableColumns';

interface TaskTableRowProps {
  task: Task;
  academicTaskTypes: AcademicTaskTypeOption[];
  onReschedule?: (e: React.MouseEvent, task: Task) => void;
  isRescheduling?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  density?: TableDensity;
  columnOrder: TasksTableColumnId[];
}

const CENTERED_COLUMNS = new Set<TasksTableColumnId>(['status', 'grade', 'calendar']);

export default function TaskTableRow({
  task,
  academicTaskTypes,
  onReschedule,
  isRescheduling = false,
  isSelected,
  onToggleSelect,
  density = 'comfortable',
  columnOrder,
}: TaskTableRowProps) {
  const academicTypeLabel = resolveOptionLabel(task.academicType, academicTaskTypes);
  const status = getDateStatus(task);
  const isCompact = density === 'compact';
  // Compact drops the secondary line under each cell (remaining-time
  // label, topics, academic type/weight) - the primary value (date, area,
  // title, status) stays, this just cuts row height for scanning a long
  // list rather than reading one task in detail.
  const cellPadding = isCompact ? 'px-4 py-1.5' : 'px-4 py-3';

  // One entry per column id in tasksTableColumns.ts - same set, same
  // order-independence, so TasksTableHeader.tsx and this file can never
  // drift (e.g. a column added to one but not the other).
  const cellContent: Record<TasksTableColumnId, ReactNode> = {
    date: (
      <>
        <div>{new Date(task.date).toLocaleDateString()}</div>
        {!isCompact && (
          <div className="mt-1 flex flex-col items-start gap-1">
            <span className="-ml-0.5">
              <DateStatusBadge status={status} />
            </span>
            <span className="text-[11px] text-neutral-500 whitespace-nowrap">
              {getRemainingTimeLabel(task)}
            </span>
          </div>
        )}
      </>
    ),
    area: (
      <div className="flex items-center gap-2">
        {task.area?.colorHex && <ColorDot color={task.area.colorHex} />}
        <span className="truncate max-w-[10rem]">{task.area?.name || 'N/A'}</span>
      </div>
    ),
    title: (
      <>
        <div className="font-medium text-neutral-200">{task.title}</div>
        {!isCompact && task.topics && <div className="text-xs text-neutral-500 mt-0.5">{task.topics}</div>}
      </>
    ),
    type: (
      <>
        <div>{academicTypeLabel || 'N/A'}</div>
        {!isCompact && (
          <div className="mt-0.5">{task.weightPercentage ? `${task.weightPercentage}%` : 'N/A'}</div>
        )}
      </>
    ),
    difficulty: (
      <>
        <DifficultyBadge difficulty={task.difficulty} />
        {!isCompact && task.priority && (
          <div className="mt-1">
            <PriorityBadge label={task.priorityLabel ?? task.priority} colorHex={task.priorityColorHex} />
          </div>
        )}
        <PostponedIndicator count={task.postponedCount} className="mt-1" />
      </>
    ),
    status: <StatusBadge status={task.progressStatus} />,
    grade: (
      <>
        <span className="font-medium text-blue-400">{task.targetGrade ?? 'N/A'}</span>
        <span className="text-neutral-600"> / </span>
        <span className="font-bold text-cyan-400">{task.realGrade ?? 'N/A'}</span>
      </>
    ),
    calendar: (
      <div className="flex flex-col items-center gap-1">
        <CalendarSyncButton task={task} />
        {status === 'overdue' && onReschedule && (
          <RescheduleButton isLoading={isRescheduling} onClick={(e) => onReschedule(e, task)} />
        )}
      </div>
    ),
  };

  return (
    <tr className="border-b border-neutral-800 hover:bg-neutral-800/30 transition-colors">
      {onToggleSelect && (
        <td className={`${cellPadding} align-middle print-hide`} onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={!!isSelected}
            onChange={() => onToggleSelect(task.id)}
            className="accent-violet-500"
            aria-label={`Select task ${task.title}`}
          />
        </td>
      )}
      {columnOrder.map((id) => (
        <td
          key={id}
          className={`${cellPadding} align-middle ${CENTERED_COLUMNS.has(id) ? 'text-center' : ''} ${
            id === 'title' ? 'font-medium text-white' : ''
          } ${id === 'type' ? 'text-xs text-neutral-400' : ''} ${id === 'grade' ? 'text-xs' : ''}`}
          onClick={id === 'calendar' ? (e) => e.stopPropagation() : undefined}
        >
          {cellContent[id]}
        </td>
      ))}
    </tr>
  );
}
