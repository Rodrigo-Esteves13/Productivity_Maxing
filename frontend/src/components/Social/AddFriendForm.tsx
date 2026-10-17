import { useState, type FormEvent } from 'react';
import type { AddFriendOutcome } from '../../hooks/useSocial';
import { useI18n } from '../../i18n/useI18n';

interface Props {
  onAdd: (code: string) => Promise<AddFriendOutcome>;
}

const MESSAGE_KEY: Record<AddFriendOutcome, string> = {
  PENDING: 'social.add.sent',
  ACCEPTED: 'social.add.nowFriends',
  NOT_FOUND: 'social.add.notFound',
  SELF: 'social.add.self',
  LIMIT: 'social.add.limit',
  ERROR: 'social.add.error',
};

export default function AddFriendForm({ onAdd }: Props) {
  const { t } = useI18n();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<AddFriendOutcome | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    const result = await onAdd(trimmed);
    setBusy(false);
    setOutcome(result);
    if (result === 'PENDING' || result === 'ACCEPTED') setCode('');
  };

  const ok = outcome === 'PENDING' || outcome === 'ACCEPTED';

  return (
    <form onSubmit={(e) => void submit(e)} className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
      <label htmlFor="friend-code" className="text-sm font-semibold text-white">
        {t('social.add.title')}
      </label>
      <div className="mt-3 flex gap-2">
        <input
          id="friend-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={32}
          autoComplete="off"
          spellCheck={false}
          placeholder={t('social.add.placeholder')}
          className="min-w-0 flex-1 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white"
        />
        <button
          type="submit"
          disabled={busy || code.trim() === ''}
          className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {t('social.add.submit')}
        </button>
      </div>
      {outcome && (
        <p role="status" className={`mt-2 text-sm ${ok ? 'text-emerald-400' : 'text-red-400'}`}>
          {t(MESSAGE_KEY[outcome])}
        </p>
      )}
    </form>
  );
}
