import { useState, type KeyboardEvent } from 'react';
import type { Subtask } from '../../types/models';
import { addSubtask, deleteSubtask, updateSubtask } from '../../api/subtasksService';
import { useFeedback } from '../../context/useFeedback';
import { TrashIcon } from '../UI/Icons';

interface SubtaskChecklistProps {
  taskId: string;
  subtasks: Subtask[];
  // Devolve a lista nova ao dono do estado (Tasks page), que a espalha pela
  // lista de tasks e pelo detalhe aberto.
  onChange: (subtasks: Subtask[]) => void;
}

// Checklist leve: sem peso, sem nota, nao conta para medias. Atualiza a UI
// logo (otimista) e reverte se a API falhar.
export default function SubtaskChecklist({ taskId, subtasks, onChange }: SubtaskChecklistProps) {
  const { notify } = useFeedback();
  const [draft, setDraft] = useState('');
  const [isAdding, setIsAdding] = useState(false);

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
          <li key={subtask.id} className="group flex items-center gap-2">
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
