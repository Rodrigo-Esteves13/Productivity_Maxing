import { useCallback, useMemo, useState, type DragEvent } from 'react';
import type { Task } from '../../types/models';
import TaskBoardColumn from './TaskBoardColumn';

interface TaskBoardProps {
  // Ja filtradas e ordenadas pela pagina (arquivadas, ordem escolhida).
  tasks: Task[];
  // Colunas, pela ordem do enum (vem de GET /tasks/meta).
  statuses: string[];
  // Muda com periodo, filtros e ordem: cada coluna volta ao primeiro bloco.
  resetKey?: string;
  onSelect: (task: Task) => void;
  onChangeStatus: (task: Task, status: string) => void;
}

const NO_TASKS: Task[] = [];

// Quadro Kanban: uma coluna por estado de progresso. As colunas fazem
// scroll horizontal dentro do quadro (a pagina nunca), com largura fixa
// ate haver espaco para as cinco lado a lado.
export default function TaskBoard({ tasks, statuses, resetKey, onSelect, onChangeStatus }: TaskBoardProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [overStatus, setOverStatus] = useState<string | null>(null);
  const [droppedId, setDroppedId] = useState<string | null>(null);

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

  const handleDrop = (status: string, e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    const task = tasks.find((candidate) => candidate.id === draggedId);
    if (task && task.progressStatus !== status) {
      setDroppedId(task.id);
      onChangeStatus(task, status);
    }
    resetDrag();
  };

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex gap-3">
        {statuses.map((status) => (
          <TaskBoardColumn
            key={status}
            status={status}
            statuses={statuses}
            tasks={tasksByStatus.get(status) ?? NO_TASKS}
            resetKey={resetKey}
            draggedId={draggedId}
            droppedId={droppedId}
            isDragOver={overStatus === status && draggedId !== null}
            onDragOver={setOverStatus}
            onDrop={handleDrop}
            onSelect={onSelect}
            onChangeStatus={onChangeStatus}
            onDragStart={handleDragStart}
            onDragEnd={resetDrag}
          />
        ))}
      </div>
    </div>
  );
}
