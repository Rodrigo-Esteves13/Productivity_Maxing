import { memo } from 'react';
import type { KeyboardEvent } from 'react';
import type { Task, Area } from '../../types/models';
import StatusBadge from '../UI/StatusBadge';
import DifficultyBadge from '../UI/DifficultyBadge';
import PriorityBadge from '../UI/PriorityBadge';
import TaskReadinessBadges from '../UI/TaskReadinessBadges';
import PostponedIndicator from '../UI/PostponedIndicator';
import SubtaskProgress from '../UI/SubtaskProgress';
import RescheduleButton from '../UI/RescheduleButton';
import IconButton from '../UI/IconButton';
import { CheckIcon, ClockIcon, PinIcon, RepeatIcon } from '../UI/Icons';
import SwipeableRow from '../UI/SwipeableRow';
import { recurrenceLabel } from '../../lib/recurrence';
import { getDateStatus } from '../../utils/taskDateStatus';
import { useI18n } from '../../i18n/useI18n';
import { formatTaskDate } from '../../lib/timeFormat';

interface TaskCardProps {
  task: Task;
  onSelect?: (task: Task) => void;
  onReschedule?: (e: React.MouseEvent | null, task: Task) => void;
  // Swipe: direita marca como feita, esquerda passa para amanha (so em atraso, como o +1 Day).
  onComplete?: (task: Task) => void;
  isRescheduling?: boolean;
  // Both optional and only meaningful together - without a full Area
  // list to pick from there's nothing to offer besides the current one,
  // so the badge just stays a plain, non-interactive label (same as
  // before this prop existed).
  areas?: Area[];
  onMoveArea?: (task: Task, areaId: string) => void;
  onTogglePin?: (task: Task) => void;
}

function TaskCard({ 
  task, 
  onSelect,
  onReschedule,
  onComplete,
  isRescheduling = false,
  areas,
  onMoveArea,
  onTogglePin,
}: TaskCardProps) {
  const { t, lang } = useI18n();
  const areaName = task.area?.name || t('ui.noArea2');
  const isInteractive = Boolean(onSelect);
  const status = getDateStatus(task);
  const canMoveArea = Boolean(areas && areas.length > 1 && onMoveArea);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!onSelect) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(task);
    }
  };

  const canComplete = Boolean(onComplete) && task.progressStatus !== 'COMPLETED';
  const canPostpone = Boolean(onReschedule) && status === 'overdue';

  return (
    <SwipeableRow
      className="h-full rounded-xl"
      onSwipeRight={canComplete ? () => onComplete?.(task) : undefined}
      onSwipeLeft={canPostpone ? () => onReschedule?.(null, task) : undefined}
      rightHint={<><CheckIcon aria-hidden="true" />{t('swipe.done')}</>}
      leftHint={<>{t('swipe.tomorrow')}<ClockIcon aria-hidden="true" /></>}
    >
    <div
      onClick={() => onSelect?.(task)}
      onKeyDown={handleKeyDown}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      // h-full garante que todos os cards de uma linha da grelha ficam com a
      // mesma altura (a grelha já estica a linha para o mais alto - isto só
      // faz o cartão em si preencher esse espaço), para o rodapé (mt-auto)
      // ficar sempre à mesma altura entre cards, seja qual for o conteúdo.
      // border-violet-500/40 quando pinned - uma pista visual sutil mesmo
      // sem reparar no ícone (útil quando a grelha tem muitos cards e o
      // pin fica fora do primeiro relance).
      className={`relative flex flex-col h-full p-4 bg-neutral-900/50 border rounded-xl transition-colors ${
        task.isPinned ? 'border-violet-500/40' : 'border-neutral-800 hover:border-violet-500/50'
      } ${isInteractive ? 'cursor-pointer' : ''}`}
    >
      {/* Cabeçalho: pin + status. A dificuldade voltou para o rodapé.
          Com 2 badges aqui, títulos longos ficavam a lutar por espaço e
          quebravam de forma inconsistente entre cards. Com só 1 badge,
          o título tem sempre a largura que precisa. */}
      <div className="flex justify-between items-start mb-3 gap-3">
        <h3 className="text-lg font-medium text-white line-clamp-2 min-w-0">
          {task.title}
          <SubtaskProgress subtasks={task.subtasks} className="ml-2 align-middle" />
        </h3>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {onTogglePin && (
            <IconButton
              label={task.isPinned ? t('ui.unpinTask') : t('ui.pinTask')}
              aria-pressed={task.isPinned}
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin(task);
              }}
              className={`-my-1.5 ${task.isPinned ? 'text-violet-400' : 'text-neutral-600 hover:text-neutral-300'}`}
            >
              <PinIcon />
            </IconButton>
          )}
          <StatusBadge status={task.progressStatus} />
        </div>
      </div>

      {/* mt-auto empurra esta secção para o fundo, para os rodapés ficarem
          sempre à mesma altura entre cards independentemente do título.
          Duas linhas fixas em vez de uma só - assim cada uma tem sempre
          espaço de sobra e nada disputa largura com o +1 Day. */}
      <div className="mt-auto pt-2 text-xs text-neutral-400 space-y-1.5">
        <div className="flex items-center gap-2">
          {canMoveArea ? (
            // A <select> instead of a real dropdown menu - free keyboard
            // nav and native mobile picker UI for a plain "pick one of
            // these" choice, no extra popover-positioning code needed.
            // Styled to still read as the same badge it replaces.
            <select
              value={task.areaId}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              onChange={(e) => {
                e.stopPropagation();
                onMoveArea!(task, e.target.value);
              }}
              title={t('ui.moveToADifferentArea')}
              className="px-2 py-1 bg-neutral-800 rounded-md font-medium text-neutral-300 truncate max-w-[10rem] border border-transparent hover:border-neutral-600 focus:border-violet-500 outline-none cursor-pointer"
            >
              {areas!.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="px-2 py-1 bg-neutral-800 rounded-md font-medium text-neutral-300 truncate max-w-[10rem]">
              {areaName}
            </span>
          )}
          <span>•</span>
          <span className={status === 'overdue' ? 'text-red-400 font-medium whitespace-nowrap' : 'whitespace-nowrap'}>
            {formatTaskDate(task.date, lang)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <DifficultyBadge difficulty={task.difficulty} />
            {task.priority && (
              <PriorityBadge priorityKey={task.priority} label={task.priorityLabel} colorHex={task.priorityColorHex} />
            )}
            <PostponedIndicator count={task.postponedCount} />
            <TaskReadinessBadges task={task} />
            {recurrenceLabel(task) && (
              <span
                title={`${recurrenceLabel(task)}. ${t('ui.nextOneCreatedOnComplete')}`}
                className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-[11px] font-medium text-violet-300"
              >
                <RepeatIcon className="h-3 w-3" />
                {recurrenceLabel(task)?.replace('Repeats ', '')}
              </span>
            )}
          </div>
          {status === 'overdue' && onReschedule && (
            <RescheduleButton
              isLoading={isRescheduling}
              onClick={(e) => onReschedule(e, task)}
            />
          )}
        </div>
      </div>
    </div>
    </SwipeableRow>
  );
}

// memo: numa lista grande, escrever num filtro ou mudar uma linha ja nao volta a renderizar todas as outras.
export default memo(TaskCard);
