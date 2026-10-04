import { useState } from 'react';
import type { FormEvent } from 'react';
import Input from '../../UI/Input';
import ActionButton from '../../UI/ActionButton';
import ErrorState from '../../UI/ErrorState';

const MAX_NAME_LENGTH = 80;
const MAX_COMMUTE_MINUTES = 240;
const DEFAULT_COMMUTE = '20';

interface CommitmentFormProps {
  initialName?: string;
  initialCommute?: number;
  submitLabel: string;
  isSaving: boolean;
  onSubmit: (name: string, commuteMinutes: number) => Promise<boolean>;
  onCancel: () => void;
}

export default function CommitmentForm({
  initialName = '',
  initialCommute,
  submitLabel,
  isSaving,
  onSubmit,
  onCancel,
}: CommitmentFormProps) {
  const [name, setName] = useState(initialName);
  const [commute, setCommute] = useState(
    initialCommute === undefined ? DEFAULT_COMMUTE : String(initialCommute),
  );
  const [formError, setFormError] = useState('');

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

    setFormError('');
    await onSubmit(name.trim(), commuteMinutes);
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
