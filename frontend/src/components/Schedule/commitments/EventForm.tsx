import { useState } from 'react';
import type { FormEvent } from 'react';
import Input from '../../UI/Input';
import ActionButton from '../../UI/ActionButton';
import ErrorState from '../../UI/ErrorState';
import { parseClock } from '../../../lib/timeFormat';
import { toDateKey } from '../../../lib/dateKey';
import { todayUtcAnchored } from '../../../lib/weekDates';
import type { CreateWorkShiftInput } from '../../../types/models';

const MAX_TITLE_LENGTH = 80;
const MAX_TRAVEL_MINUTES = 240;
const DEFAULT_START = '10:00';
const DEFAULT_END = '11:00';
const DEFAULT_TRAVEL = '0';

interface EventFormProps {
  isSaving: boolean;
  onSubmit: (input: CreateWorkShiftInput) => Promise<boolean>;
  onCancel: () => void;
}

// Evento unico sem categoria (ir ao medico, uma entrevista...): so precisa
// de um titulo, um dia e as horas. Guarda-se como um turno pontual sem
// local, e sai da lista sozinho depois do dia.
export default function EventForm({ isSaving, onSubmit, onCancel }: EventFormProps) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(toDateKey(todayUtcAnchored()));
  const [start, setStart] = useState(DEFAULT_START);
  const [end, setEnd] = useState(DEFAULT_END);
  const [travel, setTravel] = useState(DEFAULT_TRAVEL);
  const [formError, setFormError] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const startMinutes = parseClock(start);
    const endMinutes = parseClock(end);
    const bufferMinutes = Number(travel);

    if (!title.trim()) return setFormError('Give the event a title.');
    if (!date) return setFormError('Pick a date.');
    if (startMinutes === null || endMinutes === null || startMinutes >= endMinutes) {
      return setFormError('Start must be before end.');
    }
    if (!Number.isInteger(bufferMinutes) || bufferMinutes < 0 || bufferMinutes > MAX_TRAVEL_MINUTES) {
      return setFormError(`Travel time must be between 0 and ${MAX_TRAVEL_MINUTES} minutes.`);
    }

    setFormError('');
    await onSubmit({ label: title.trim(), date, startMinutes, endMinutes, bufferMinutes });
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3 rounded-lg bg-neutral-800/40 p-3">
      <Input
        label="Title"
        value={title}
        maxLength={MAX_TITLE_LENGTH}
        placeholder="Doctor, job interview..."
        onChange={(e) => setTitle(e.target.value)}
      />
      <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Input label="From" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        <Input label="To" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
        <Input
          label="Travel each way (min)"
          type="number"
          min={0}
          max={MAX_TRAVEL_MINUTES}
          value={travel}
          onChange={(e) => setTravel(e.target.value)}
        />
      </div>
      {formError && <ErrorState message={formError} />}
      <div className="flex gap-2">
        <ActionButton type="submit" disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Add event'}
        </ActionButton>
        <button type="button" onClick={onCancel} className="px-3 py-2 text-sm text-neutral-400 hover:text-white">
          Cancel
        </button>
      </div>
    </form>
  );
}
