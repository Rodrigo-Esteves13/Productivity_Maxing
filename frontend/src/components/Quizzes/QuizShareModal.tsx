import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../UI/Button';
import CopyButton from '../UI/CopyButton';
import InlineConfirm from '../UI/InlineConfirm';
import Input from '../UI/Input';
import LinesSkeleton from '../UI/LinesSkeleton';
import Modal from '../UI/Modal';
import Select from '../UI/Select';
import {
  createQuizShare,
  getQuizShare,
  removeQuizShareRecipient,
  revokeQuizShare,
  shareQuizWithFriend,
  type QuizShareStatus,
} from '../../api/quizzesService';
import { getSocialOverview, type FriendEntry } from '../../api/socialService';
import { useI18n } from '../../i18n/useI18n';
import { sharedQuizPath, socialTabPath } from '../../lib/appLinks';
import { notifySocialChanged } from '../../lib/socialEvents';

interface QuizShareModalProps {
  quizId: string;
  isOpen: boolean;
  onClose: () => void;
  // O quiz passou a estar (ou deixou de estar) partilhado.
  onChanged: (isShared: boolean) => void;
}

const NO_FRIEND = '';

// Partilhar um quiz so dentro da app: o link so abre com sessao iniciada e da
// a quem o abre uma copia na conta dele. Nao ha ficheiro nem download.
export default function QuizShareModal({ quizId, isOpen, onClose, onChanged }: QuizShareModalProps) {
  const { t, lang } = useI18n();
  const [status, setStatus] = useState<QuizShareStatus | null>(null);
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [friendId, setFriendId] = useState(NO_FRIEND);
  const [isBusy, setIsBusy] = useState(false);
  const [askRevoke, setAskRevoke] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [share, social] = await Promise.all([getQuizShare(quizId), getSocialOverview()]);
      setStatus(share);
      setFriends(social.friends);
    } catch {
      setError(t('quizzes.share.loadError'));
    }
  }, [quizId, t]);

  useEffect(() => {
    if (isOpen) void load();
  }, [isOpen, load]);

  const run = async (action: () => Promise<QuizShareStatus | null>) => {
    setIsBusy(true);
    setError('');
    try {
      const next = await action();
      setStatus(next ?? { token: null, copyCount: 0, createdAt: null, recipients: [] });
      onChanged(Boolean(next?.token));
      notifySocialChanged();
    } catch {
      setError(t('quizzes.share.error'));
    } finally {
      setIsBusy(false);
    }
  };

  const link = status?.token ? `${window.location.origin}${sharedQuizPath(status.token)}` : '';
  const recipientIds = useMemo(() => new Set(status?.recipients.map((r) => r.userId)), [status]);
  const available = friends.filter((f) => !recipientIds.has(f.userId));

  const sendToFriend = () =>
    run(async () => {
      const next = await shareQuizWithFriend(quizId, friendId);
      setFriendId(NO_FRIEND);
      return next;
    });

  const removeRecipient = (recipientId: string) =>
    run(async () => {
      await removeQuizShareRecipient(quizId, recipientId);
      return getQuizShare(quizId);
    });

  const revoke = () =>
    run(async () => {
      await revokeQuizShare(quizId);
      setAskRevoke(false);
      return null;
    });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('quizzes.share.title')}>
      <div className="space-y-5">
        <p className="text-sm text-neutral-300">{t('quizzes.share.help')}</p>
        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}
        {!status ? (
          !error && <LinesSkeleton lines={3} />
        ) : (
          <>
            <section className="space-y-2" aria-label={t('quizzes.share.linkTitle')}>
              <h3 className="text-sm font-semibold text-white">{t('quizzes.share.linkTitle')}</h3>
              {status.token ? (
                <>
                  <div className="flex gap-2">
                    <Input readOnly value={link} aria-label={t('quizzes.share.linkTitle')} onFocus={(e) => e.target.select()} />
                    <CopyButton text={link} />
                  </div>
                  <p className="text-xs text-neutral-400">{t('quizzes.share.copies', { count: status.copyCount })}</p>
                  {askRevoke ? (
                    <InlineConfirm
                      message={t('quizzes.share.revokeConfirm')}
                      confirmLabel={t('quizzes.share.revoke')}
                      isBusy={isBusy}
                      onConfirm={() => void revoke()}
                      onCancel={() => setAskRevoke(false)}
                    />
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => setAskRevoke(true)}>
                      {t('quizzes.share.revoke')}
                    </Button>
                  )}
                </>
              ) : (
                <Button size="sm" disabled={isBusy} onClick={() => void run(() => createQuizShare(quizId))}>
                  {t('quizzes.share.create')}
                </Button>
              )}
            </section>

            <section className="space-y-2" aria-label={t('quizzes.share.friendsTitle')}>
              <h3 className="text-sm font-semibold text-white">{t('quizzes.share.friendsTitle')}</h3>
              {friends.length === 0 ? (
                <p className="text-xs text-neutral-400">
                  {t('quizzes.share.noFriends')}{' '}
                  <Link to={socialTabPath('friends')} onClick={onClose} className="text-violet-300 underline-offset-2 hover:underline">
                    {t('nav.social')}
                  </Link>
                </p>
              ) : (
                <div className="flex gap-2">
                  <Select aria-label={t('quizzes.share.pickFriend')} value={friendId} onChange={(e) => setFriendId(e.target.value)}>
                    <option value={NO_FRIEND}>{t('quizzes.share.pickFriend')}</option>
                    {available.map((f) => (
                      <option key={f.userId} value={f.userId}>
                        {f.name ?? t('quizzes.share.unnamed')}
                      </option>
                    ))}
                  </Select>
                  <Button size="sm" disabled={isBusy || friendId === NO_FRIEND} onClick={() => void sendToFriend()}>
                    {t('quizzes.share.send')}
                  </Button>
                </div>
              )}
              {status.recipients.length > 0 && (
                <ul className="divide-y divide-neutral-800 rounded-lg border border-neutral-800">
                  {status.recipients.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                      <span className="flex-1 text-neutral-200">{r.name || t('quizzes.share.unnamed')}</span>
                      <span className={`text-xs ${r.addedAt ? 'text-violet-300' : 'text-neutral-400'}`}>
                        {r.addedAt ? t('quizzes.share.added', { date: new Date(r.addedAt).toLocaleDateString(lang) }) : t('quizzes.share.notAdded')}
                      </span>
                      <Button size="sm" variant="secondary" disabled={isBusy} onClick={() => void removeRecipient(r.id)}>
                        {t('quizzes.share.remove')}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </Modal>
  );
}
