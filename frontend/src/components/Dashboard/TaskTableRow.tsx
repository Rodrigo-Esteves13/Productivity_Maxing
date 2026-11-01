import { memo } from 'react';
import type { ReactNode } from 'react';
import StatusBadge from '../UI/StatusBadge';
import DifficultyBadge from '../UI/DifficultyBadge';
import PriorityBadge from '../UI/PriorityBadge';
import TaskReadinessBadges from '../UI/TaskReadinessBadges';
import TagChips from '../UI/TagChips';
import PostponedIndicator from '../UI/PostponedIndicator';
import DateStatusBadge from '../UI/DateStatusBadge';
import ColorDot from '../UI/ColorDot';
import RescheduleButton from '../UI/RescheduleButton';
import ViewTaskButton from '../UI/ViewTaskButton';
import AttachmentCount from '../UI/AttachmentCount';
import SubtaskProgress from '../UI/SubtaskProgress';
import CalendarSyncButton from './CalendarSyncButton';
import { getDateStatus, getRemainingTimeLabel } from '../../utils/taskDateStatus';
import { useCatalogLabel } from '../../hooks/useCatalogLabel';
import type { Task, AcademicTaskTypeOption } from '../../types/models';
import type { TableDensity } from '../../hooks/useTableDensity';
import type { TasksTableColumnId } from '../../lib/tasksTableColumns';
import { useI18n } from '../../i18n/useI18n';
import { formatHandIn, formatTaskDue } from '../../lib/taskReadiness';

interface TaskTableRowProps {
  task: Task;
  academicTaskTypes: AcademicTaskTypeOption[];
  onReschedule?: (e: React.MouseEvent | null, task: Task) => void;
  isRescheduling?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  density?: TableDensity;
  columnOrder: TasksTableColumnId[];
}

const CENTERED_COLUMNS = new Set<TasksTableColumnId>(['status', 'grade', 'calendar']);

function TaskTableRow({
  task,
  academicTaskTypes,
  onReschedule,
  isRescheduling = false,
  isSelected,
  onToggleSelect,
  density = 'comfortable',
  columnOrder,
}: TaskTableRowProps) {
  const { t, lang } = useI18n();
  const { optionLabel } = useCatalogLabel();
  const academicTypeLabel = optionLabel('academicType', task.academicType, academicTaskTypes);
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
        <div>{formatTaskDue(task, lang)}</div>
        {formatHandIn(task, lang) && <div className="text-xs text-neutral-400">{formatHandIn(task, lang)}</div>}
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
        <div className="font-medium text-neutral-200">
          {task.title}
          <SubtaskProgress subtasks={task.subtasks} className="ml-2 align-middle" />
          <AttachmentCount count={task.attachmentCount} className="ml-2 align-middle" />
        </div>
        {!isCompact && task.tags?.length ? (
          <div className="mt-1 flex flex-wrap gap-1">
            <TagChips tags={task.tags} />
          </div>
        ) : null}
        {!isCompact && task.topics && <div className="text-xs text-neutral-500 mt-0.5">{task.topics}</div>}
      </>
    ),
    type: (
      <>
        <div>{academicTypeLabel || 'N/A'}</div>
        {!isCompact && (
          <div className="mt-0.5 tabular-nums">{task.weightPercentage ? `${task.weightPercentage}%` : 'N/A'}</div>
        )}
      </>
    ),
    difficulty: (
      // Coluna em pilha: dificuldade, adiada e readiness ficam sempre na
      // mesma ordem e alinhados a esquerda, sem alguns lado a lado e outros
      // em linha propria conforme a largura.
      <div className="flex flex-col items-start gap-1">
        <DifficultyBadge difficulty={task.difficulty} />
        <PostponedIndicator count={task.postponedCount} />
        <TaskReadinessBadges task={task} variant="badge" />
      </div>
    ),
    priority: task.priority ? (
      <PriorityBadge priorityKey={task.priority} label={task.priorityLabel} colorHex={task.priorityColorHex} />
    ) : (
      <span className="text-neutral-500">N/A</span>
    ),
    status: <StatusBadge status={task.progressStatus} size="sm" />,
    grade: (
      <>
        <span className="font-medium text-blue-400">{task.targetGrade ?? 'N/A'}</span>
        <span className="text-neutral-600"> / </span>
        <span className="font-bold text-cyan-400">{task.realGrade ?? 'N/A'}</span>
      </>
    ),
    calendar: (
      <div className="flex flex-col items-center gap-1">
        <ViewTaskButton taskId={task.id} title={task.title} />
        <CalendarSyncButton task={task} />
        {status === 'overdue' && onReschedule && (
          <RescheduleButton isLoading={isRescheduling} onClick={(e) => onReschedule(e, task)} />
        )}
      </div>
    ),
  };

  return (
    <tr
      className={`border-b border-neutral-800 transition-colors duration-[var(--duration-quick)] ease-smooth-out ${
        isSelected ? 'bg-violet-500/10' : 'hover:bg-neutral-800/30'
      }`}
    >
      {onToggleSelect && (
        <td className={`${cellPadding} align-middle print-hide`} onClick={(e) => e.stopPropagation()}>
          {/* Alvo de 40px (-m-3 p-3) sem aumentar a linha. */}
          <label className="-m-3 flex w-fit cursor-pointer p-3">
            <input
              type="checkbox"
              checked={!!isSelected}
              onChange={() => onToggleSelect(task.id)}
              className="h-4 w-4 cursor-pointer accent-violet-500"
              aria-label={t('ui.selectTaskNamed', { title: task.title })}
            />
          </label>
        </td>
      )}
      {columnOrder.map((id) => (
        <td
          key={id}
          className={`${cellPadding} align-middle ${CENTERED_COLUMNS.has(id) ? 'text-center' : ''} ${
            id === 'title' ? 'font-medium text-white' : ''
          } ${id === 'type' ? 'text-xs text-neutral-400' : ''} ${id === 'grade' ? 'text-xs tabular-nums' : ''}`}
          onClick={id === 'calendar' ? (e) => e.stopPropagation() : undefined}
        >
          {cellContent[id]}
        </td>
      ))}
    </tr>
  );
}

// memo: numa lista grande, escrever num filtro ou mudar uma linha ja nao volta a renderizar todas as outras.
export default memo(TaskTableRow);
