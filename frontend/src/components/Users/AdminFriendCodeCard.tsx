import { Link } from 'react-router-dom';
import CopyButton from '../UI/CopyButton';
import { RepeatIcon } from '../UI/Icons';
import type { AdminCodeRequest } from '../../api/adminSocialService';
import { useI18n } from '../../i18n/useI18n';

const STATUS_STYLE: Record<AdminCodeRequest['status'], string> = {
  PENDING: 'border-amber-800/60 bg-amber-900/20 text-amber-300',
  APPROVED: 'border-emerald-800/60 bg-emerald-900/20 text-emerald-300',
  REJECTED: 'border-neutral-700 bg-neutral-800 text-neutral-400',
};

interface Props {
  code: string | null;
  requests: AdminCodeRequest[];
  isRegenerating: boolean;
  onRegenerate: () => void;
}

// O admin ve o codigo de amigo e gera um novo quando quiser (sem pedido).
// O historico de pedidos da pessoa ajuda a perceber porque.
export default function AdminFriendCodeCard({ code, requests, isRegenerating, onRegenerate }: Props) {
  const { t, lang } = useI18n();
  const hasPending = requests.some((r) => r.status === 'PENDING');
  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-neutral-100">{t('adminSocial.code.title')}</h2>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {code ? (
          <>
            <code className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono text-base tracking-wider text-violet-200 break-all">
              {code}
            </code>
            <CopyButton text={code} label={t('adminSocial.code.copy')} />
          </>
        ) : (
          <p className="text-sm text-neutral-500">{t('adminSocial.code.none')}</p>
        )}
        <button
          type="button"
          onClick={onRegenerate}
          disabled={isRegenerating}
          className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
        >
          <RepeatIcon className="h-3.5 w-3.5" />
          {isRegenerating
            ? t('adminSocial.code.generating')
            : code
              ? t('adminSocial.code.regenerate')
              : t('adminSocial.code.generate')}
        </button>
      </div>
      {hasPending && (
        <p className="mt-2 text-xs text-amber-300">
          {t('adminSocial.code.pending')}{' '}
          <Link to="/friend-code-requests" className="underline hover:text-amber-200">
            {t('adminSocial.code.openQueue')}
          </Link>
        </p>
      )}

      <h3 className="mt-5 text-xs font-medium uppercase tracking-wide text-neutral-500">
        {t('adminSocial.code.history')}
      </h3>
      {requests.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">{t('adminSocial.code.noHistory')}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {requests.map((r) => (
            <li key={r.id} className="rounded-lg border border-neutral-800 bg-neutral-950/40 p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                <span className={`rounded-full border px-2 py-0.5 font-medium ${STATUS_STYLE[r.status]}`}>
                  {t(`adminSocial.code.status.${r.status}`)}
                </span>
                <span>{new Date(r.createdAt).toLocaleDateString(lang)}</span>
              </div>
              {/* Texto do utilizador: nunca como HTML. */}
              <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-neutral-200">{r.reason}</p>
              {r.adminNote && (
                <p className="mt-1 text-xs text-neutral-400">{t('adminSocial.code.note', { note: r.adminNote })}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
