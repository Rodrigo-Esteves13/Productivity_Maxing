import { useState, type SyntheticEvent } from 'react';
import Input from '../UI/Input';
import Button from '../UI/Button';
import FormField from '../UI/FormField';
import type { User } from '../../types/models';

interface UserStatusModalProps {
  target: User;
  mode: 'ban' | 'suspend';
  isSubmitting: boolean;
  onSubmit: (payload: { reason: string; until?: string }) => Promise<void> | void;
  onCancel: () => void;
}

// Default de 7 dias a partir de agora, no formato que <input type="date">
// espera (YYYY-MM-DD) - só usado como valor inicial do campo, o admin
// pode mudar livremente antes de submeter.
function defaultUntilDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

export default function UserStatusModal({ target, mode, isSubmitting, onSubmit, onCancel }: UserStatusModalProps) {
  const [reason, setReason] = useState('');
  const [until, setUntil] = useState(defaultUntilDate());

  const isBan = mode === 'ban';

  const handleSubmit = (e: SyntheticEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    if (!isBan && !until) return;
    // Meio-dia local, mesmo raciocínio que NotebookEntryEditor.tsx: evita
    // a data escolhida "saltar" um dia por arredondamento UTC.
    onSubmit({ reason: reason.trim(), until: isBan ? undefined : `${until}T12:00:00` });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <p className="text-sm text-neutral-400">
        {isBan ? (
          <>
            <span className="font-medium text-red-400">{target.name || target.email}</span> will be permanently
            banned and logged out immediately, everywhere.
          </>
        ) : (
          <>
            <span className="font-medium text-amber-400">{target.name || target.email}</span> will be suspended and
            logged out immediately - the account reactivates on its own once the date below passes.
          </>
        )}
      </p>

      <FormField label="Reason" htmlFor="status-reason">
        <textarea
          id="status-reason"
          required
          rows={3}
          maxLength={500}
          placeholder={isBan ? 'Why is this account being banned?' : 'Why is this account being suspended?'}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full block border border-neutral-700 bg-neutral-900 text-white rounded-lg px-3 py-2.5 text-sm placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-violet-600/50 focus:border-violet-500"
        />
      </FormField>

      {!isBan && (
        <FormField label="Suspended until" htmlFor="status-until">
          <Input
            id="status-until"
            type="date"
            required
            min={new Date().toISOString().slice(0, 10)}
            value={until}
            onChange={(e) => setUntil(e.target.value)}
          />
        </FormField>
      )}

      <div className="pt-4 flex justify-end gap-3 border-t border-neutral-800 mt-6">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-medium rounded-md transition-colors"
        >
          {isSubmitting ? 'Saving...' : isBan ? 'Ban account' : 'Suspend account'}
        </button>
      </div>
    </form>
  );
}
