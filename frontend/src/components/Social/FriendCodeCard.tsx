import { useState } from 'react';
import { useI18n } from '../../i18n/useI18n';
import type { CodeChangeRequest } from '../../api/socialService';

const MIN_REASON = 10;
const MAX_REASON = 500;

interface Props {
  code: string;
  request: CodeChangeRequest | null;
  onRequestChange: (reason: string) => Promise<boolean>;
}

// O codigo nao se troca sozinho (para ninguem o rodar sem necessidade): pede-se
// ao admin, com um motivo, e o resultado aparece aqui.
export default function FriendCodeCard({ code, request, onRequestChange }: Props) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [reason, setReason] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [failed, setFailed] = useState(false);

  const pending = request?.status === 'PENDING';
  const rejected = request?.status === 'REJECTED';
  const canSend = reason.trim().length >= MIN_REASON && !isSending;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // o codigo continua visivel
    }
  };

  const send = async () => {
    setIsSending(true);
    setFailed(false);
    const ok = await onRequestChange(reason.trim());
    setIsSending(false);
    if (ok) {
      setIsAsking(false);
      setReason('');
    } else {
      setFailed(true);
    }
  };

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
      <h2 className="text-sm font-semibold text-white">{t('social.code.title')}</h2>
      <p className="mt-1 text-xs text-neutral-500">{t('social.code.hint')}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code className="rounded-md bg-neutral-800 px-3 py-1.5 font-mono text-sm text-violet-300 select-all break-all">
          {code}
        </code>
        <button
          type="button"
          onClick={() => void copy()}
          className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500"
        >
          {copied ? t('packs.list.copied') : t('social.code.copy')}
        </button>
        {!pending && !isAsking && (
          <button type="button" onClick={() => setIsAsking(true)} className="text-sm text-neutral-400 hover:text-white">
            {t('social.code.request')}
          </button>
        )}
      </div>

      {pending && <p className="mt-3 text-xs text-amber-400">{t('social.code.pending')}</p>}
      {rejected && !isAsking && (
        <div className="mt-3 text-xs text-neutral-400">
          <p className="text-red-400">{t('social.code.rejected')}</p>
          {request?.adminNote && <p className="mt-1 break-words">{t('social.code.note', { note: request.adminNote })}</p>}
        </div>
      )}

      {isAsking && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-neutral-500">{t('social.code.requestHint')}</p>
          <textarea
            value={reason}
            maxLength={MAX_REASON}
            rows={3}
            aria-label={t('social.code.reason')}
            placeholder={t('social.code.reason')}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-violet-500 focus:outline-none"
          />
          {failed && <p className="text-xs text-red-400">{t('social.code.requestError')}</p>}
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!canSend}
              onClick={() => void send()}
              className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
            >
              {t('social.code.send')}
            </button>
            <button type="button" onClick={() => setIsAsking(false)} className="text-sm text-neutral-400 hover:text-white">
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
