import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { UseEntryShareResult } from '../../hooks/useEntryShare';
import { useFriendOptions } from '../../hooks/useFriendOptions';
import type { ShareAccessRole } from '../../types/models';
import { useI18n } from '../../i18n/useI18n';

const ROLES: ShareAccessRole[] = ['EDITOR', 'CO_OWNER', 'VIEWER'];
const ROLE_KEY: Record<ShareAccessRole, string> = {
  VIEWER: 'share.role.viewer',
  EDITOR: 'share.role.editor',
  CO_OWNER: 'share.role.coOwner',
};

const SELECT_CLASS =
  'min-w-0 rounded-md border border-neutral-700 bg-neutral-950 px-1.5 py-1 text-xs text-neutral-200 focus:border-violet-500 focus:outline-none disabled:opacity-50';

// Convidar um AMIGO para esta nota com um papel. O amigo tem de aceitar
// (aparece em Social > Shared with me) e o acesso so vale enquanto forem amigos.
export default function NotebookEntryInvite({ share }: { share: UseEntryShareResult }) {
  const { t } = useI18n();
  const { friends, isLoading } = useFriendOptions(true);
  const [friendId, setFriendId] = useState('');
  const [role, setRole] = useState<ShareAccessRole>('EDITOR');
  const [isSending, setIsSending] = useState(false);

  // Quem ja tem acesso/convite nao aparece na lista.
  const taken = new Set(share.requests.map((r) => r.requestingUser.id));
  const options = friends.filter((f) => !taken.has(f.userId));

  const send = async () => {
    if (!friendId) return;
    setIsSending(true);
    const ok = await share.invite(friendId, role);
    setIsSending(false);
    if (ok) setFriendId('');
  };

  return (
    <div className="mt-3 border-t border-neutral-800 pt-2">
      <p className="mb-1 text-xs font-medium text-neutral-300">{t('share.invite.title')}</p>
      <p className="mb-2 text-[11px] text-neutral-500">{t('share.invite.hint')}</p>
      {!isLoading && friends.length === 0 ? (
        <p className="text-xs text-neutral-500">
          {t('share.invite.noFriends')}{' '}
          <Link to="/social" className="text-violet-400 hover:underline">
            {t('nav.social')}
          </Link>
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          <select
            value={friendId}
            disabled={isLoading || isSending}
            aria-label={t('share.invite.pick')}
            onChange={(e) => setFriendId(e.target.value)}
            className={`${SELECT_CLASS} flex-1`}
          >
            <option value="">{t('share.invite.pick')}</option>
            {options.map((f) => (
              <option key={f.userId} value={f.userId}>
                {f.name ?? t('social.anonymous')}
              </option>
            ))}
          </select>
          <select
            value={role}
            disabled={isSending}
            aria-label={t('share.role.label')}
            onChange={(e) => setRole(e.target.value as ShareAccessRole)}
            className={SELECT_CLASS}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {t(ROLE_KEY[r])}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!friendId || isSending}
            onClick={() => void send()}
            className="rounded-md bg-violet-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {t('share.invite.send')}
          </button>
        </div>
      )}
    </div>
  );
}
