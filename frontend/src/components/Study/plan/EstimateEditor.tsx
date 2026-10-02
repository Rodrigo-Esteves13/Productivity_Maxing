import { useState } from 'react';
import type { FormEvent } from 'react';
import { updateTask } from '../../../api/userService';

const MIN_HOURS = 0.25;
const MAX_HOURS = 15; // alinhado com MAX_TASK_MINUTES (900) no backend
const MINUTES_PER_HOUR = 60;

interface EstimateEditorProps {
  taskId: string;
  currentMinutes: number;
  onSaved: () => void;
  onCancel: () => void;
}

// Define a estimativa manual da task (Task.estimatedMinutes) sem sair do
// plano: é a forma mais direta de corrigir um palpite que não bate certo
// com a realidade, e passa a mandar sobre previsão e valores por defeito.
export default function EstimateEditor({ taskId, currentMinutes, onSaved, onCancel }: EstimateEditorProps) {
  const [hours, setHours] = useState(String(Math.round((currentMinutes / MINUTES_PER_HOUR) * 4) / 4));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const value = Number(hours);
    if (!Number.isFinite(value) || value < MIN_HOURS || value > MAX_HOURS) {
      setError(`Between ${MIN_HOURS} and ${MAX_HOURS} hours.`);
      return;
    }

    try {
      setIsSaving(true);
      setError('');
      await updateTask(taskId, { estimatedMinutes: Math.round(value * MINUTES_PER_HOUR) });
      onSaved();
    } catch {
      setError('Could not save the estimate.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="mt-2 flex flex-wrap items-center gap-2">
      <label className="text-xs text-neutral-400" htmlFor={`estimate-${taskId}`}>
        Hours needed
      </label>
      <input
        id={`estimate-${taskId}`}
        type="number"
        step={0.25}
        min={MIN_HOURS}
        max={MAX_HOURS}
        value={hours}
        autoFocus
        onChange={(e) => setHours(e.target.value)}
        className="w-20 bg-neutral-900 border border-neutral-700 rounded-md px-2 py-1 text-sm text-neutral-100"
      />
      <button
        type="submit"
        disabled={isSaving}
        className="px-2.5 py-1 text-xs rounded-md bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50"
      >
        {isSaving ? 'Saving...' : 'Save'}
      </button>
      <button type="button" onClick={onCancel} className="text-xs text-neutral-400 hover:text-white">
        Cancel
      </button>
      {error && <span role="alert" className="text-xs text-red-400">{error}</span>}
    </form>
  );
}
