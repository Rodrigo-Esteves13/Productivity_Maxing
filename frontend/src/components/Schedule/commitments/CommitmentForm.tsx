import { useState } from 'react';
import type { FormEvent } from 'react';
import Input from '../../UI/Input';
import ActionButton from '../../UI/ActionButton';
import ErrorState from '../../UI/ErrorState';
import ToggleChip from '../../UI/ToggleChip';
import { WEEKDAYS } from './shiftText';

const MAX_NAME_LENGTH = 80;
const MAX_COMMUTE_MINUTES = 240;
const DEFAULT_COMMUTE = '20';
// Tem de haver pelo menos um dia de trabalho possivel (igual ao backend).
const MAX_DAYS_OFF = 6;

interface CommitmentFormProps {
  initialName?: string;
  initialCommute?: number;
  initialDaysOff?: number[];
  submitLabel: string;
  isSaving: boolean;
  onSubmit: (name: string, commuteMinutes: number, daysOff: number[]) => Promise<boolean>;
  onCancel: () => void;
}

export default function CommitmentForm({
  initialName = '',
  initialCommute,
  initialDaysOff = [],
  submitLabel,
  isSaving,
  onSubmit,
  onCancel,
}: CommitmentFormProps) {
  const [name, setName] = useState(initialName);
  const [commute, setCommute] = useState(
    initialCommute === undefined ? DEFAULT_COMMUTE : String(initialCommute),
  );
  const [daysOff, setDaysOff] = useState<number[]>(initialDaysOff);
  const [formError, setFormError] = useState('');

  const toggleDayOff = (value: number) =>
    setDaysOff((prev) => (prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value]));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const commuteMinutes = Number(commute);

    if (!name.trim()) {
      setFormError('Give it a name.');
      return;
    }
    if (!Number.isInteger(commuteMinutes) || commuteMinutes < 0 || commuteMinutes > MAX_COMMUTE_MINUTES) {
      setFormError(`Travel time must be between 0 and ${MAX_COMMUTE_MINUTES} minutes.`);
      return;
    }

    if (daysOff.length > MAX_DAYS_OFF) {
      setFormError('Keep at least one working day.');
      return;
    }

    setFormError('');
    await onSubmit(name.trim(), commuteMinutes, daysOff);
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3 rounded-lg bg-neutral-800/40 p-3">
      <Input
        label="Name"
        value={name}
        maxLength={MAX_NAME_LENGTH}
        placeholder="Work, Gym..."
        onChange={(e) => setName(e.target.value)}
      />
      <Input
        label="Travel time each way (min)"
        type="number"
        min={0}
        max={MAX_COMMUTE_MINUTES}
        value={commute}
        onChange={(e) => setCommute(e.target.value)}
      />
      <fieldset>
        <legend className="block text-sm font-medium text-neutral-300 mb-1">Fixed days off</legend>
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAYS.map((d) => (
            <ToggleChip
              key={d.value}
              size="sm"
              pressed={daysOff.includes(d.value)}
              disabled={!daysOff.includes(d.value) && daysOff.length >= MAX_DAYS_OFF}
              onClick={() => toggleDayOff(d.value)}
            >
              {d.label}
            </ToggleChip>
          ))}
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          Weekly shifts are skipped on these days, here and when you replicate or copy.
        </p>
      </fieldset>
      {formError && <ErrorState message={formError} />}
      <div className="flex gap-2">
        <ActionButton type="submit" disabled={isSaving}>
          {isSaving ? 'Saving...' : submitLabel}
        </ActionButton>
        <button type="button" onClick={onCancel} className="px-3 py-2 text-sm text-neutral-400 hover:text-white">
          Cancel
        </button>
      </div>
    </form>
  );
}
