import { useState, type SyntheticEvent } from 'react';
import Input from '../UI/Input';
import Button from '../UI/Button';
import FormField from '../UI/FormField';
import type { User } from '../../types/models';
import { toDateKey, todayKey } from '../../lib/dateKey';
import { useI18n } from '../../i18n/useI18n';
import { fillNodes } from '../../i18n/fillNodes';

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
  return toDateKey(d);
}

export default function UserStatusModal({ target, mode, isSubmitting, onSubmit, onCancel }: UserStatusModalProps) {
  const { t } = useI18n();
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
            {fillNodes(t('ui.userWillBeBanned'), {
              name: <span className="font-medium text-red-400">{target.name || target.email}</span>,
            })}
          </>
        ) : (
          <>
            {fillNodes(t('ui.userWillBeSuspended'), {
              name: <span className="font-medium text-amber-400">{target.name || target.email}</span>,
            })}
          </>
        )}
      </p>

      <FormField label={t('ui.reason')} htmlFor="status-reason">
        <textarea
          id="status-reason"
          required
          rows={3}
          maxLength={500}
          placeholder={isBan ? t('ui.whyIsThisAccountBeing') : t('ui.whyIsThisAccountBeing2')}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full block border border-neutral-700 bg-neutral-900 text-white rounded-lg px-3 py-2.5 text-sm placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-violet-600/50 focus:border-violet-500"
        />
      </FormField>

      {!isBan && (
        <FormField label={t('ui.suspendedUntil')} htmlFor="status-until">
          <Input
            id="status-until"
            type="date"
            required
            min={todayKey()}
            value={until}
            onChange={(e) => setUntil(e.target.value)}
          />
        </FormField>
      )}

      <div className="pt-4 flex justify-end gap-3 border-t border-neutral-800 mt-6">
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t('ui.cancel')}
        </Button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-medium rounded-md transition-colors"
        >
          {isSubmitting ? t('common.saving') : isBan ? t('ui.banAccount') : t('ui.suspendAccount')}
        </button>
      </div>
    </form>
  );
}
