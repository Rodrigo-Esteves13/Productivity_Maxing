import { useState, type FormEvent } from 'react';
import type { AddFriendOutcome } from '../../hooks/useSocial';
import ToggleChip from '../UI/ToggleChip';
import { useI18n } from '../../i18n/useI18n';

type Mode = 'code' | 'email';
export type EmailFriendOutcome = 'SENT' | 'LIMIT' | 'ERROR';

interface Props {
  /** Codigo de amigo ou link de amizade colado. */
  onAdd: (codeOrLink: string) => Promise<AddFriendOutcome>;
  onAddByEmail: (email: string) => Promise<EmailFriendOutcome>;
}

const MESSAGE_KEY: Record<AddFriendOutcome, string> = {
  PENDING: 'social.add.sent',
  ACCEPTED: 'social.add.nowFriends',
  NOT_FOUND: 'social.add.notFound',
  SELF: 'social.add.self',
  LIMIT: 'social.add.limit',
  ERROR: 'social.add.error',
};

const EMAIL_MESSAGE_KEY: Record<EmailFriendOutcome, string> = {
  SENT: 'social.email.sent',
  LIMIT: 'social.add.limit',
  ERROR: 'social.add.error',
};

// Dois caminhos para o mesmo pedido: o codigo (ou o link de amizade colado)
// e o email. O email responde sempre igual, exista a conta ou nao.
export default function AddFriendForm({ onAdd, onAddByEmail }: Props) {
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>('code');
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ key: string; ok: boolean } | null>(null);

  const switchMode = (next: Mode) => {
    setMode(next);
    setValue('');
    setMessage(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    if (mode === 'code') {
      const result = await onAdd(trimmed);
      const ok = result === 'PENDING' || result === 'ACCEPTED';
      setMessage({ key: MESSAGE_KEY[result], ok });
      if (ok) setValue('');
    } else {
      const result = await onAddByEmail(trimmed);
      setMessage({ key: EMAIL_MESSAGE_KEY[result], ok: result === 'SENT' });
      if (result === 'SENT') setValue('');
    }
    setBusy(false);
  };

  const inputId = mode === 'code' ? 'friend-code' : 'friend-email';

  return (
    <form onSubmit={(e) => void submit(e)} className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={inputId} className="text-sm font-semibold text-white">
          {t('social.add.title')}
        </label>
        <div role="group" aria-label={t('social.add.how')} className="flex gap-1">
          <ToggleChip size="sm" pressed={mode === 'code'} onClick={() => switchMode('code')}>
            {t('social.add.byCode')}
          </ToggleChip>
          <ToggleChip size="sm" pressed={mode === 'email'} onClick={() => switchMode('email')}>
            {t('social.add.byEmail')}
          </ToggleChip>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <input
          id={inputId}
          type={mode === 'email' ? 'email' : 'text'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={mode === 'email' ? 254 : 300}
          autoComplete={mode === 'email' ? 'email' : 'off'}
          spellCheck={false}
          placeholder={t(mode === 'email' ? 'social.email.placeholder' : 'social.add.placeholderLink')}
          className="min-w-0 flex-1 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white"
        />
        <button
          type="submit"
          disabled={busy || value.trim() === ''}
          className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {t('social.add.submit')}
        </button>
      </div>
      {mode === 'email' && !message && <p className="mt-2 text-xs text-neutral-500">{t('social.email.hint')}</p>}
      {message && (
        <p role="status" className={`mt-2 text-sm ${message.ok ? 'text-violet-400' : 'text-red-400'}`}>
          {t(message.key)}
        </p>
      )}
    </form>
  );
}
