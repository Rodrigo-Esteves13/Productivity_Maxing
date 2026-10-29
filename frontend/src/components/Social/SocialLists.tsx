import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { SocialOverview } from '../../api/socialService';
import type { OutgoingGrant } from '../../api/socialNotesService';
import { useI18n } from '../../i18n/useI18n';
import { friendNotesPath, friendPath } from '../../lib/appLinks';
import PersonRow from './PersonRow';

export type SocialListSection = 'incoming' | 'outgoing' | 'friends' | 'blocked';

interface Props {
  data: SocialOverview;
  /** Que listas mostrar (cada separador do Social mostra as suas). */
  sections: SocialListSection[];
  onAccept: (friendshipId: string) => Promise<boolean>;
  onRemove: (friendshipId: string) => Promise<boolean>;
  onBlock: (userId: string) => Promise<boolean>;
  onUnblock: (userId: string) => Promise<boolean>;
  outgoingGrants: OutgoingGrant[];
  onRequestNotes: (ownerId: string) => Promise<boolean>;
}

const btn = 'text-sm text-neutral-400 hover:text-white';

function Section({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  if (count === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-white">
        {title} <span className="text-neutral-500">({count})</span>
      </h2>
      <ul className="space-y-2">{children}</ul>
    </section>
  );
}

export default function SocialLists({
  data,
  sections,
  onAccept,
  onRemove,
  onBlock,
  onUnblock,
  outgoingGrants,
  onRequestNotes,
}: Props) {
  const { t, lang } = useI18n();
  // Remover amigo e bloquear pedem confirmacao (ids com prefixo da acao).
  const [confirm, setConfirm] = useState<string | null>(null);

  const confirmable = (key: string, label: string, confirmLabel: string, action: () => Promise<boolean>) =>
    confirm === key ? (
      <>
        <button
          type="button"
          onClick={() => void action().then(() => setConfirm(null))}
          className="rounded-md bg-red-600/80 px-2.5 py-1 text-sm text-white hover:bg-red-600"
        >
          {confirmLabel}
        </button>
        <button type="button" onClick={() => setConfirm(null)} className={btn}>
          {t('common.cancel')}
        </button>
      </>
    ) : (
      <button type="button" onClick={() => setConfirm(key)} className={`${btn} hover:text-red-400`}>
        {label}
      </button>
    );

  const notesControl = (friendId: string) => {
    const grant = outgoingGrants.find((g) => g.ownerId === friendId);
    if (grant?.status === 'APPROVED') {
      return (
        <Link to={friendNotesPath(friendId)} className="text-sm text-violet-400 hover:text-violet-300">
          {t('social.notes.read')}
        </Link>
      );
    }
    if (grant) return <span className="text-xs text-neutral-500">{t('social.notes.requested')}</span>;
    return (
      <button type="button" onClick={() => void onRequestNotes(friendId)} className={btn}>
        {t('social.notes.ask')}
      </button>
    );
  };

  return (
    <div className="space-y-6">
      <Section title={t('social.incoming')} count={sections.includes('incoming') ? data.incoming.length : 0}>
        {data.incoming.map((r) => (
          <PersonRow key={r.friendshipId} person={r} subtitle={t('social.wantsToBeFriends')}>
            <button
              type="button"
              onClick={() => void onAccept(r.friendshipId)}
              className="rounded-md bg-violet-600 px-2.5 py-1 text-sm font-medium text-white hover:bg-violet-500"
            >
              {t('social.accept')}
            </button>
            <button type="button" onClick={() => void onRemove(r.friendshipId)} className={btn}>
              {t('social.decline')}
            </button>
            {confirmable(`block:${r.userId}`, t('social.block'), t('social.blockConfirm'), () => onBlock(r.userId))}
          </PersonRow>
        ))}
      </Section>

      <Section title={t('social.outgoing')} count={sections.includes('outgoing') ? data.outgoing.length : 0}>
        {data.outgoing.map((r) => (
          <PersonRow key={r.friendshipId} person={r} subtitle={t('social.waiting')}>
            <button type="button" onClick={() => void onRemove(r.friendshipId)} className={btn}>
              {t('social.cancelRequest')}
            </button>
          </PersonRow>
        ))}
      </Section>

      <Section title={t('social.friends')} count={sections.includes('friends') ? data.friends.length : 0}>
        {data.friends.map((f) => (
          <PersonRow
            key={f.friendshipId}
            person={f}
            to={friendPath(f.userId)}
            subtitle={t('social.since', { date: new Date(f.since).toLocaleDateString(lang) })}
          >
            <Link
              to={friendPath(f.userId)}
              className="rounded-md border border-neutral-700 px-2.5 py-1 text-sm text-neutral-200 hover:border-violet-700 hover:text-white"
            >
              {t('social.friend.open')}
            </Link>
            {notesControl(f.userId)}
            {/* Remover e bloquear ficam no perfil: aqui so o que se usa no dia a dia. */}
          </PersonRow>
        ))}
      </Section>

      <Section title={t('social.blocked')} count={sections.includes('blocked') ? data.blocked.length : 0}>
        {data.blocked.map((b) => (
          <PersonRow key={b.userId} person={b}>
            <button type="button" onClick={() => void onUnblock(b.userId)} className={btn}>
              {t('social.unblock')}
            </button>
          </PersonRow>
        ))}
      </Section>
    </div>
  );
}
