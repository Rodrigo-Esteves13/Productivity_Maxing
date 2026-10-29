import { useCallback, useMemo, useState, type DragEvent } from 'react';
import type { ProgressStatus, Task } from '../../types/models';
import StatusBadge from '../UI/StatusBadge';
import TaskBoardCard from './TaskBoardCard';
import { useEnumLabel } from '../../hooks/useEnumLabel';
import { useI18n } from '../../i18n/useI18n';

interface TaskBoardProps {
  // Ja filtradas e ordenadas pela pagina (arquivadas, ordem escolhida).
  tasks: Task[];
  // Colunas, pela ordem do enum (vem de GET /tasks/meta).
  statuses: string[];
  onSelect: (task: Task) => void;
  onChangeStatus: (task: Task, status: string) => void;
}

// Quadro Kanban: uma coluna por estado de progresso. As colunas fazem
// scroll horizontal dentro do quadro (a pagina nunca), com largura fixa
// ate haver espaco para as cinco lado a lado.
export default function TaskBoard({ tasks, statuses, onSelect, onChangeStatus }: TaskBoardProps) {
  const { t } = useI18n();
  const enumLabel = useEnumLabel();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [overStatus, setOverStatus] = useState<string | null>(null);

  const tasksByStatus = useMemo(() => {
    const groups = new Map<string, Task[]>(statuses.map((status) => [status, []]));
    for (const task of tasks) groups.get(task.progressStatus)?.push(task);
    return groups;
  }, [tasks, statuses]);

  const resetDrag = useCallback(() => {
    setDraggedId(null);
    setOverStatus(null);
  }, []);

  // Estavel (useCallback) para os cartoes memorizados nao renderizarem todos
  // de cada vez que um comeca a ser arrastado.
  const handleDragStart = useCallback((task: Task, e: DragEvent<HTMLLIElement>) => {
    setDraggedId(task.id);
    // Firefox exige um setData para o drag comecar (ver TaskGrid).
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDrop = (status: string) => (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    const task = tasks.find((candidate) => candidate.id === draggedId);
    if (task && task.progressStatus !== status) onChangeStatus(task, status);
    resetDrag();
  };

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex gap-3">
        {statuses.map((status) => {
          const columnTasks = tasksByStatus.get(status) ?? [];
          return (
            <section
              key={status}
              aria-label={t('board.column', { status: enumLabel(status), count: columnTasks.length })}
              onDragOver={(e) => {
                e.preventDefault(); // obrigatorio para onDrop disparar
                if (overStatus !== status) setOverStatus(status);
              }}
              onDrop={handleDrop(status)}
              className={`flex w-[78vw] max-w-[18rem] shrink-0 flex-col rounded-xl border bg-neutral-900/40 p-2 xl:w-auto xl:max-w-none xl:flex-1 xl:min-w-0 ${
                overStatus === status && draggedId ? 'border-violet-500/70' : 'border-neutral-800'
              }`}
            >
              <header className="flex items-center justify-between gap-2 px-1 pb-2">
                <StatusBadge status={status as ProgressStatus} />
                <span className="text-xs text-neutral-500">{columnTasks.length}</span>
              </header>
              {columnTasks.length === 0 ? (
                <p className="px-1 py-4 text-center text-xs text-neutral-500">{t('board.empty')}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {columnTasks.map((task) => (
                    <TaskBoardCard
                      key={task.id}
                      task={task}
                      statuses={statuses}
                      isDragging={draggedId === task.id}
                      onSelect={onSelect}
                      onChangeStatus={onChangeStatus}
                      onDragStart={handleDragStart}
                      onDragEnd={resetDrag}
                    />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
