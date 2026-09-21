import { useState, type DragEvent } from 'react';
import TaskCard from './TaskCard';
import type { Task, Area } from '../../types/models';

interface TaskGridProps {
  tasks: Task[];
  onSelect: (task: Task) => void;
  onReschedule?: (e: React.MouseEvent, task: Task) => void;
  reschedulingId?: string | null;
  areas?: Area[];
  onMoveArea?: (task: Task, areaId: string) => void;
  onTogglePin?: (task: Task) => void;
  // Chamado com a sequência completa de IDs já na nova ordem, assim que
  // um drag termina num alvo diferente do de origem - ver
  // useTasksPage.reorderTasksInState, que trata do optimistic update e
  // do PATCH /tasks/reorder. NOTA: como o card inteiro fica draggable
  // (não há um "handle" dedicado), arrastar a partir de um controlo
  // interativo do card (o select de Area, o botão de pin) pode competir
  // com o clique nesse controlo em alguns browsers - aceitável para v1,
  // mas se isso incomodar no uso real, a solução é mover `draggable`
  // para um pequeno ícone de "arrastar" dentro do TaskCard em vez do
  // wrapper inteiro.
  onReorder?: (orderedIds: string[]) => void;
}

export default function TaskGrid({
  tasks,
  onSelect,
  onReschedule,
  reschedulingId,
  areas,
  onMoveArea,
  onTogglePin,
  onReorder,
}: TaskGridProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Mesmo algoritmo (remover + inserir antes do alvo) do reorderColumns
  // em useTasksTableColumnOrder.ts, só que aqui a lista reordenada é
  // logo mandada para fora via onReorder - este componente não guarda
  // ordem nenhuma a mais, tasks[] (vindo do pai) já é a fonte da verdade.
  const handleDrop = (targetId: string) => (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (onReorder && draggedId && draggedId !== targetId) {
      const ids = tasks.map((t) => t.id);
      const next = ids.filter((id) => id !== draggedId);
      const targetIndex = next.indexOf(targetId);
      next.splice(targetIndex, 0, draggedId);
      onReorder(next);
    }
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleDragStart = (id: string) => (e: DragEvent<HTMLDivElement>) => {
    setDraggedId(id);
    // Firefox exige um setData para o drag sequer começar - o valor em si
    // nunca é lido de volta, onDrop usa o estado do componente (draggedId).
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (id: string) => (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); // obrigatório para onDrop disparar
    if (id !== dragOverId) setDragOverId(id);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {tasks.map((task) => (
        <div
          key={task.id}
          draggable={!!onReorder}
          onDragStart={handleDragStart(task.id)}
          onDragOver={handleDragOver(task.id)}
          onDrop={handleDrop(task.id)}
          onDragEnd={() => {
            setDraggedId(null);
            setDragOverId(null);
          }}
          className={`rounded-xl transition-shadow h-full ${onReorder ? 'cursor-grab active:cursor-grabbing' : ''} ${
            dragOverId === task.id && draggedId !== task.id
              ? 'ring-2 ring-violet-500/60'
              : ''
          } ${draggedId === task.id ? 'opacity-40' : ''}`}
        >
          <TaskCard
            task={task}
            onSelect={onSelect}
            onReschedule={onReschedule}
            isRescheduling={reschedulingId === task.id}
            areas={areas}
            onMoveArea={onMoveArea}
            onTogglePin={onTogglePin}
          />
        </div>
      ))}
    </div>
  );
}
