import { memo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import Button from '../UI/Button';
import Textarea from '../UI/Textarea';
import { adminUserPath } from '../../lib/appLinks';
import { FEEDBACK_REPLY_MAX_LENGTH } from '../../api/feedbackService';
import { useI18n } from '../../i18n/useI18n';
import { useAuth } from '../../context/useAuth';
import type { AccountAction } from '../../hooks/useFeedbackAdmin';
import type { FeedbackAuthor, FeedbackItem, UserStatus } from '../../types/models';
import { feedbackStatusKey, FEEDBACK_STATUS_CLASS } from './feedbackStatus';

type Composer = 'reply' | 'reject';

const ACCOUNT_STATUS_KEY: Partial<Record<UserStatus, string>> = {
  BANNED: 'ui.accountBanned',
  SUSPENDED: 'ui.accountSuspended',
};

const LINK_BUTTON = 'text-xs text-violet-300 hover:text-violet-200 disabled:opacity-50';
const DANGER_LINK_BUTTON = 'text-xs text-red-400 hover:text-red-300 disabled:opacity-50';

interface FeedbackAdminItemProps {
  item: FeedbackItem;
  onToggleResolved: (item: FeedbackItem) => Promise<boolean>;
  onReply: (id: string, message: string, resolve: boolean) => Promise<boolean>;
  onReject: (id: string, reason: string) => Promise<boolean>;
  onToggleMuted: (author: FeedbackAuthor) => Promise<boolean>;
  onAccountAction: (author: FeedbackAuthor, action: AccountAction) => void;
  onReactivate: (author: FeedbackAuthor) => Promise<boolean>;
}

// Um feedback na lista do admin: ler, responder, recusar, resolver e moderar
// o autor (bloquear feedback, suspender, banir).
function FeedbackAdminItem({
  item,
  onToggleResolved,
  onReply,
  onReject,
  onToggleMuted,
  onAccountAction,
  onReactivate,
}: FeedbackAdminItemProps) {
  const { t } = useI18n();
  const [composer, setComposer] = useState<Composer | null>(null);
  const [text, setText] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const { user: me } = useAuth();
  const author = item.user;
  // O backend recusa moderar a propria conta: nem mostrar os botoes.
  const canModerateAuthor = author !== null && author.id !== me?.id;
  const accountStatusKey = author ? ACCOUNT_STATUS_KEY[author.status] : undefined;

  const openComposer = (next: Composer) => {
    setComposer((current) => (current === next ? null : next));
    setText(next === 'reply' ? item.adminReply ?? '' : '');
  };

  const busy = async (action: () => Promise<boolean>) => {
    setIsBusy(true);
    const ok = await action();
    setIsBusy(false);
    return ok;
  };

  const submit = async (resolve: boolean) => {
    const message = text.trim();
    if (composer === 'reply' && !message) return;
    const ok = await busy(() =>
      composer === 'reply' ? onReply(item.id, message, resolve) : onReject(item.id, message),
    );
    if (ok) {
      setComposer(null);
      setText('');
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submit(false);
  };

  return (
    <li
      className={`rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 ${item.isResolved ? 'opacity-70' : ''}`}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400">
        <span className={`rounded-full border px-2 py-0.5 ${FEEDBACK_STATUS_CLASS[feedbackStatusKey(item)]}`}>
          {t(feedbackStatusKey(item))}
        </span>
        <span className="rounded-full border border-neutral-700 px-2 py-0.5">{item.category}</span>
        <span className="rounded-full border border-neutral-700 px-2 py-0.5 uppercase">{item.language}</span>
        {item.rating !== null && <span>{item.rating}/5</span>}
        {item.page && <span className="font-mono">{item.page}</span>}
        {author ? (
          <Link to={adminUserPath(author.id)} className="text-neutral-300 hover:text-white">
            {author.name || author.email}
          </Link>
        ) : (
          <span>{t('feedback.admin.deletedUser')}</span>
        )}
        {accountStatusKey && (
          <span className="rounded-full border border-red-800 px-2 py-0.5 text-red-300">{t(accountStatusKey)}</span>
        )}
        {author?.feedbackMutedAt && (
          <span className="rounded-full border border-amber-700 px-2 py-0.5 text-amber-300">
            {t('feedback.admin.muted')}
          </span>
        )}
        <span>{new Date(item.createdAt).toLocaleString()}</span>
      </div>

      {/* Texto de utilizador: nunca como HTML. */}
      <p lang={item.language} className="mt-2 whitespace-pre-wrap break-words text-sm text-neutral-100">
        {item.message}
      </p>

      {item.adminReply && (
        <div className="mt-3 rounded-lg border-l-2 border-violet-500 bg-neutral-950/60 px-3 py-2">
          <p className="text-xs text-neutral-400">
            {t('feedback.admin.yourReply')}
            {item.repliedAt && ` · ${new Date(item.repliedAt).toLocaleString()}`}
          </p>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-neutral-200">{item.adminReply}</p>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button type="button" disabled={isBusy} onClick={() => openComposer('reply')} className={LINK_BUTTON}>
          {item.adminReply ? t('feedback.admin.editReply') : t('feedback.admin.reply')}
        </button>
        {item.resolution !== 'REJECTED' && (
          <button type="button" disabled={isBusy} onClick={() => openComposer('reject')} className={DANGER_LINK_BUTTON}>
            {t('feedback.admin.decline')}
          </button>
        )}
        <button
          type="button"
          disabled={isBusy}
          onClick={() => void busy(() => onToggleResolved(item))}
          className={LINK_BUTTON}
        >
          {item.isResolved ? t('ui.reopen') : t('ui.markResolved')}
        </button>

        {author && canModerateAuthor && (
          <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2">
            <button
              type="button"
              disabled={isBusy}
              onClick={() => void busy(() => onToggleMuted(author))}
              className={LINK_BUTTON}
            >
              {author.feedbackMutedAt ? t('feedback.admin.unmuteUser') : t('feedback.admin.muteUser')}
            </button>
            {author.status === 'ACTIVE' ? (
              <>
                <button type="button" onClick={() => onAccountAction(author, 'suspend')} className={DANGER_LINK_BUTTON}>
                  {t('feedback.admin.suspend')}
                </button>
                <button type="button" onClick={() => onAccountAction(author, 'ban')} className={DANGER_LINK_BUTTON}>
                  {t('ui.ban')}
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => void busy(() => onReactivate(author))}
                className={LINK_BUTTON}
              >
                {t('ui.reactivate')}
              </button>
            )}
          </div>
        )}
      </div>

      {composer && (
        <form onSubmit={handleSubmit} className="mt-3 space-y-2">
          <Textarea
            autoFocus
            rows={3}
            maxLength={FEEDBACK_REPLY_MAX_LENGTH}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              composer === 'reply' ? t('feedback.admin.replyPlaceholder') : t('feedback.admin.declinePlaceholder')
            }
            aria-label={composer === 'reply' ? t('feedback.admin.reply') : t('feedback.admin.decline')}
          />
          {!author && <p className="text-xs text-neutral-500">{t('feedback.admin.noAuthorNotice')}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setComposer(null)}>
              {t('ui.cancel')}
            </Button>
            {composer === 'reply' ? (
              <>
                <Button type="submit" variant="secondary" size="sm" disabled={isBusy || !text.trim()}>
                  {t('feedback.admin.sendReply')}
                </Button>
                {!item.isResolved && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={isBusy || !text.trim()}
                    onClick={() => void submit(true)}
                  >
                    {t('feedback.admin.sendAndResolve')}
                  </Button>
                )}
              </>
            ) : (
              <Button type="submit" variant="danger" size="sm" disabled={isBusy}>
                {t('feedback.admin.decline')}
              </Button>
            )}
          </div>
        </form>
      )}
    </li>
  );
}

export default memo(FeedbackAdminItem);
