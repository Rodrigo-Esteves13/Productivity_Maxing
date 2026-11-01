import { memo } from 'react';
import type { DragEvent } from 'react';
import type { Task } from '../../types/models';
import ColorDot from '../UI/ColorDot';
import PriorityBadge from '../UI/PriorityBadge';
import TagChips from '../UI/TagChips';
import TaskReadinessBadges from '../UI/TaskReadinessBadges';
import AttachmentCount from '../UI/AttachmentCount';
import SubtaskProgress from '../UI/SubtaskProgress';
import { getDateStatus } from '../../utils/taskDateStatus';
import { useEnumLabel } from '../../hooks/useEnumLabel';
import { useI18n } from '../../i18n/useI18n';
import { formatTaskDue } from '../../lib/taskReadiness';

interface TaskBoardCardProps {
  task: Task;
  statuses: string[];
  isDragging: boolean;
  onSelect: (task: Task) => void;
  onChangeStatus: (task: Task, status: string) => void;
  // Recebe a task: o quadro passa um handler estavel (o memo do cartao conta).
  onDragStart: (task: Task, e: DragEvent<HTMLLIElement>) => void;
  onDragEnd: () => void;
}

// Cartao compacto do quadro. Arrastar entre colunas muda o estado (rato);
// o select no fundo faz o mesmo com teclado ou no telemovel, onde o
// drag-and-drop nativo nao existe.
function TaskBoardCard({
  task,
  statuses,
  isDragging,
  onSelect,
  onChangeStatus,
  onDragStart,
  onDragEnd,
}: TaskBoardCardProps) {
  const { t, lang } = useI18n();
  const enumLabel = useEnumLabel();
  const isOverdue = getDateStatus(task) === 'overdue';

  return (
    <li
      draggable
      onDragStart={(e) => onDragStart(task, e)}
      onDragEnd={onDragEnd}
      className={`cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-40' : ''}`}
    >
      {/* Clique em qualquer sitio abre a task; para o teclado o botao e o
          titulo (um role="button" a volta do select era um botao com um
          controlo la dentro). */}
      <div
        onClick={() => onSelect(task)}
        className={`rounded-lg border bg-neutral-900 p-3 transition-[border-color] duration-[var(--duration-quick)] ease-smooth-out ${
          task.isPinned ? 'border-violet-500/40' : 'border-neutral-800 hover:border-neutral-700'
        }`}
      >
        <p className="break-words text-sm font-medium text-neutral-100 line-clamp-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(task);
            }}
            className="inline text-left hover:text-violet-200"
          >
            {task.title}
          </button>
          <SubtaskProgress subtasks={task.subtasks} className="ml-2 align-middle" />
          <AttachmentCount count={task.attachmentCount} className="ml-2 align-middle" />
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-neutral-400">
          {task.area?.colorHex && <ColorDot color={task.area.colorHex} />}
          <span className="max-w-[9rem] truncate">{task.area?.name || t('ui.noArea2')}</span>
          <span className={isOverdue ? 'whitespace-nowrap font-medium text-red-400' : 'whitespace-nowrap'}>
            {formatTaskDue(task, lang)}
          </span>
          {task.priority && (
            <PriorityBadge priorityKey={task.priority} label={task.priorityLabel} colorHex={task.priorityColorHex} />
          )}
          <TaskReadinessBadges task={task} />
          <TagChips tags={task.tags} />
        </div>
        <select
          value={task.progressStatus}
          aria-label={t('board.moveTo', { title: task.title })}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          onChange={(e) => onChangeStatus(task, e.target.value)}
          className="mt-2 w-full cursor-pointer rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-xs text-neutral-300 focus:border-violet-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
        >
          {statuses.map((status) => (
            <option key={status} value={status}>
              {enumLabel(status)}
            </option>
          ))}
        </select>
      </div>
    </li>
  );
}

// memo: numa lista grande, escrever num filtro ou mudar uma linha ja nao volta a renderizar todas as outras.
export default memo(TaskBoardCard);
