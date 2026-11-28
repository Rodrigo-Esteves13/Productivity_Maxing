import type { DragEvent } from 'react';
import type { ProgressStatus, Task } from '../../types/models';
import StatusBadge from '../UI/StatusBadge';
import ShowMoreTasksButton from '../UI/ShowMoreTasksButton';
import TaskBoardCard from './TaskBoardCard';
import { useRevealedTasks } from '../../hooks/useRevealedTasks';
import { useEnumLabel } from '../../hooks/useEnumLabel';
import { useI18n } from '../../i18n/useI18n';

interface TaskBoardColumnProps {
  status: string;
  statuses: string[];
  // Todas as tasks da coluna (o cabecalho conta-as todas).
  tasks: Task[];
  resetKey?: string;
  draggedId: string | null;
  // A ultima task largada: fica visivel na coluna de destino.
  droppedId: string | null;
  isDragOver: boolean;
  onDragOver: (status: string) => void;
  onDrop: (status: string, e: DragEvent<HTMLElement>) => void;
  onSelect: (task: Task) => void;
  onChangeStatus: (task: Task, status: string) => void;
  onDragStart: (task: Task, e: DragEvent<HTMLLIElement>) => void;
  onDragEnd: () => void;
}

export default function TaskBoardColumn({
  status,
  statuses,
  tasks,
  resetKey,
  draggedId,
  droppedId,
  isDragOver,
  onDragOver,
  onDrop,
  onSelect,
  onChangeStatus,
  onDragStart,
  onDragEnd,
}: TaskBoardColumnProps) {
  const { t } = useI18n();
  const enumLabel = useEnumLabel();
  const { visible, remaining, showMore } = useRevealedTasks(
    tasks,
    resetKey,
    droppedId ? tasks.findIndex((task) => task.id === droppedId) : -1,
  );

  return (
    <section
      aria-label={t('board.column', { status: enumLabel(status), count: tasks.length })}
      onDragOver={(e) => {
        e.preventDefault(); // obrigatorio para onDrop disparar
        onDragOver(status);
      }}
      onDrop={(e) => onDrop(status, e)}
      className={`flex w-[78vw] max-w-[18rem] shrink-0 flex-col rounded-2xl border bg-neutral-900/40 p-2 transition-colors duration-[var(--duration-quick)] ease-smooth-out xl:w-auto xl:max-w-none xl:flex-1 xl:min-w-0 ${
        isDragOver ? 'border-violet-500/70' : 'border-neutral-800'
      }`}
    >
      <header className="flex items-center justify-between gap-2 px-1 pb-2">
        <StatusBadge status={status as ProgressStatus} />
        <span className="text-xs tabular-nums text-neutral-500">{tasks.length}</span>
      </header>
      {tasks.length === 0 ? (
        <p className="px-1 py-4 text-center text-xs text-neutral-500">{t('board.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((task) => (
            <TaskBoardCard
              key={task.id}
              task={task}
              statuses={statuses}
              isDragging={draggedId === task.id}
              onSelect={onSelect}
              onChangeStatus={onChangeStatus}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          ))}
        </ul>
      )}
      <ShowMoreTasksButton remaining={remaining} onClick={showMore} />
    </section>
  );
}
