import { memo } from 'react';
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
import SwipeableRow from '../UI/SwipeableRow';
import { CheckIcon, ClockIcon } from '../UI/Icons';
import { getDateStatus, getRemainingTimeLabel } from '../../utils/taskDateStatus';
import { useCatalogLabel } from '../../hooks/useCatalogLabel';
import type { Task, AcademicTaskTypeOption } from '../../types/models';
import { useI18n } from '../../i18n/useI18n';
import { formatHandIn, formatTaskDue } from '../../lib/taskReadiness';

interface TaskCardProps {
  task: Task;
  academicTaskTypes: AcademicTaskTypeOption[];
  // Novas props adicionadas aqui!
  onReschedule?: (e: React.MouseEvent | null, task: Task) => void;
  // Swipe: direita marca como feita, esquerda passa para amanha (so em atraso, como o +1 Day).
  onComplete?: (task: Task) => void;
  isRescheduling?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
}

function TaskCard({
  task,
  academicTaskTypes,
  onReschedule,
  onComplete,
  isRescheduling = false,
  isSelected,
  onToggleSelect,
}: TaskCardProps) {
  const { t, lang } = useI18n();
  const { optionLabel } = useCatalogLabel();
  const academicTypeLabel = optionLabel('academicType', task.academicType, academicTaskTypes);
  const status = getDateStatus(task);
  const canComplete = Boolean(onComplete) && task.progressStatus !== 'COMPLETED';
  const canPostpone = Boolean(onReschedule) && status === 'overdue';

  return (
    <SwipeableRow
      className="border-b border-neutral-800 last:border-b-0"
      onSwipeRight={canComplete ? () => onComplete?.(task) : undefined}
      onSwipeLeft={canPostpone ? () => onReschedule?.(null, task) : undefined}
      rightHint={<><CheckIcon aria-hidden="true" />{t('swipe.done')}</>}
      leftHint={<>{t('swipe.tomorrow')}<ClockIcon aria-hidden="true" /></>}
    >
    <div
      className={`p-4 transition-colors duration-[var(--duration-quick)] ease-smooth-out ${
        isSelected ? 'bg-violet-500/10' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex items-start gap-2">
          {onToggleSelect && (
            // Alvo de 40px (-m-3 p-3); -mt-2 mantem o checkbox onde estava (mt-1).
            <label className="print-hide -m-3 -mt-2 flex shrink-0 cursor-pointer p-3">
              <input
                type="checkbox"
                checked={!!isSelected}
                onChange={() => onToggleSelect(task.id)}
                className="h-4 w-4 cursor-pointer accent-violet-500"
                aria-label={t('ui.selectTaskNamed', { title: task.title })}
              />
            </label>
          )}
          <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-medium text-white">
            {task.area?.colorHex && <ColorDot color={task.area.colorHex} />}
            <span className="truncate">{task.area?.name || 'N/A'}</span>
          </div>
          <div className="font-medium text-neutral-100 mt-1 break-words">
            {task.title}
            <SubtaskProgress subtasks={task.subtasks} className="ml-2 align-middle" />
            <AttachmentCount count={task.attachmentCount} className="ml-2 align-middle" />
          </div>
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
        {task.priority && (
          <PriorityBadge priorityKey={task.priority} label={task.priorityLabel} colorHex={task.priorityColorHex} />
        )}
        <StatusBadge status={task.progressStatus} size="sm" />
        <span className="text-[11px] text-neutral-400">{academicTypeLabel}</span>
        <PostponedIndicator count={task.postponedCount} />
        <TaskReadinessBadges task={task} variant="badge" />
        <TagChips tags={task.tags} />
      </div>

      {/* Row 2: actions (Sync on the left, Reschedule on the right), its own fixed
          row that never mixes with the badges above, so "+1 Day" never ends up
          orphaned mid-wrap. */}
      <div className="flex items-center gap-2 mt-2">
        <ViewTaskButton taskId={task.id} title={task.title} />
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
          <div className="text-[10px] uppercase text-neutral-500">{t('ui.date')}</div>
          <div className="text-xs text-neutral-300 mt-0.5">{formatTaskDue(task, lang)}</div>
          {formatHandIn(task, lang) && (
            <div className="text-xs text-neutral-400">{formatHandIn(task, lang)}</div>
          )}
        </div>
        <div>
          <div className="text-[10px] uppercase text-neutral-500">{t('ui.weight')}</div>
          <div className="text-xs tabular-nums text-neutral-300 mt-0.5">
            {task.weightPercentage ? `${task.weightPercentage}%` : 'N/A'}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-neutral-500">{t('ui.targetReal')}</div>
          <div className="text-xs tabular-nums mt-0.5">
            <span className="font-medium text-blue-400">{task.targetGrade ?? 'N/A'}</span>
            <span className="text-neutral-600"> / </span>
            <span className="font-bold text-cyan-400">{task.realGrade ?? 'N/A'}</span>
          </div>
        </div>
      </div>
    </div>
    </SwipeableRow>
  );
}

// memo: numa lista grande, escrever num filtro ou mudar uma linha ja nao volta a renderizar todas as outras.
export default memo(TaskCard);
