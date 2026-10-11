import { useState, type KeyboardEvent } from 'react';
import type { Subtask, Task } from '../../types/models';
import {
  addSubtask,
  convertSubtaskToTask,
  deleteSubtask,
  reorderSubtasks,
  updateSubtask,
} from '../../api/subtasksService';
import { useFeedback } from '../../context/useFeedback';
import { TrashIcon } from '../UI/Icons';

interface SubtaskChecklistProps {
  taskId: string;
  subtasks: Subtask[];
  // Devolve a lista nova ao dono do estado (Tasks page), que a espalha pela
  // lista de tasks e pelo detalhe aberto.
  onChange: (subtasks: Subtask[]) => void;
  // Passo promovido a task propria (a lista de tasks tem de a receber).
  onConverted?: (task: Task) => void;
}

// Checklist leve: sem peso, sem nota, nao conta para medias. Atualiza a UI
// logo (otimista) e reverte se a API falhar.
export default function SubtaskChecklist({ taskId, subtasks, onChange, onConverted }: SubtaskChecklistProps) {
  const { notify } = useFeedback();
  const [draft, setDraft] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  // Arrastar para reordenar (HTML5 drag and drop, sem dependencias).
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const done = subtasks.filter((s) => s.isDone).length;
  const percent = subtasks.length === 0 ? 0 : Math.round((done / subtasks.length) * 100);

  const handleAdd = async () => {
    const title = draft.trim();
    if (!title || isAdding) return;
    setIsAdding(true);
    try {
      const created = await addSubtask(taskId, title);
      onChange([...subtasks, created]);
      setDraft('');
    } catch {
      notify('Could not add the subtask. Please try again.', 'error');
    } finally {
      setIsAdding(false);
    }
  };

  const handleToggle = async (subtask: Subtask) => {
    const previous = subtasks;
    onChange(subtasks.map((s) => (s.id === subtask.id ? { ...s, isDone: !s.isDone } : s)));
    try {
      await updateSubtask(taskId, subtask.id, { isDone: !subtask.isDone });
    } catch {
      onChange(previous);
      notify('Could not update the subtask.', 'error');
    }
  };

  const handleDelete = async (subtask: Subtask) => {
    const previous = subtasks;
    onChange(subtasks.filter((s) => s.id !== subtask.id));
    try {
      await deleteSubtask(taskId, subtask.id);
    } catch {
      onChange(previous);
      notify('Could not delete the subtask.', 'error');
    }
  };

  const handleConvert = async (subtask: Subtask) => {
    const previous = subtasks;
    onChange(subtasks.filter((s) => s.id !== subtask.id));
    try {
      const created = await convertSubtaskToTask(taskId, subtask.id);
      onConverted?.(created);
      notify('Step promoted to its own task.', 'success');
    } catch {
      onChange(previous);
      notify('Could not convert the step to a task.', 'error');
    }
  };

  const handleDrop = async (targetId: string) => {
    const sourceId = draggedId;
    setDraggedId(null);
    if (!sourceId || sourceId === targetId) return;
    const from = subtasks.findIndex((s) => s.id === sourceId);
    const to = subtasks.findIndex((s) => s.id === targetId);
    if (from === -1 || to === -1) return;

    const previous = subtasks;
    const next = [...subtasks];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
    try {
      await reorderSubtasks(taskId, next.map((s) => s.id));
    } catch {
      onChange(previous);
      notify('Could not save the new order.', 'error');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleAdd();
    }
    // Evita que atalhos da pagina (E, C, Del...) disparem enquanto se escreve.
    e.stopPropagation();
  };

  return (
    <div className="space-y-2">
      {subtasks.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 rounded-full bg-neutral-800 overflow-hidden">
            <div className="h-full bg-violet-500 transition-all" style={{ width: `${percent}%` }} />
          </div>
          <span className="text-xs text-neutral-400 tabular-nums">
            {done}/{subtasks.length}
          </span>
        </div>
      )}

      <ul className="space-y-1">
        {subtasks.map((subtask) => (
          <li
            key={subtask.id}
            draggable
            onDragStart={() => setDraggedId(subtask.id)}
            onDragEnd={() => setDraggedId(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => void handleDrop(subtask.id)}
            className={`group flex items-center gap-2 ${draggedId === subtask.id ? 'opacity-40' : ''}`}
          >
            <span className="cursor-grab text-neutral-600 select-none" aria-hidden="true" title="Drag to reorder">
              ::
            </span>
            <input
              type="checkbox"
              checked={subtask.isDone}
              onChange={() => void handleToggle(subtask)}
              className="accent-violet-500"
              aria-label={`Mark "${subtask.title}" as ${subtask.isDone ? 'not done' : 'done'}`}
            />
            <span
              className={`flex-1 text-sm break-words ${
                subtask.isDone ? 'line-through text-neutral-500' : 'text-neutral-200'
              }`}
            >
              {subtask.title}
            </span>
            {onConverted && (
              <button
                type="button"
                onClick={() => void handleConvert(subtask)}
                className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-[11px] text-neutral-500 hover:text-violet-300 transition-opacity"
                title="Turn this step into its own task"
              >
                To task
              </button>
            )}
            <button
              type="button"
              onClick={() => void handleDelete(subtask)}
              className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-neutral-500 hover:text-red-400 transition-opacity"
              aria-label={`Delete subtask "${subtask.title}"`}
              title="Delete subtask"
            >
              <TrashIcon width={14} height={14} />
            </button>
          </li>
        ))}
      </ul>

      <input
        type="text"
        value={draft}
        maxLength={200}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isAdding}
        placeholder="Add a step and press Enter"
        className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-1.5 text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-violet-600"
      />
    </div>
  );
}
