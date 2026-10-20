import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PageLayout from '../components/Layout/PageLayout';
import Breadcrumbs from '../components/UI/Breadcrumbs';
import ErrorState from '../components/UI/ErrorState';
import EmptyState from '../components/UI/EmptyState';
import CardGridSkeleton from '../components/UI/CardGridSkeleton';
import PersonAvatar from '../components/Social/PersonAvatar';
import ShareNoteWithFriend from '../components/Social/ShareNoteWithFriend';
import InvitationCard from '../components/SharedWithMe/InvitationCard';
import { ROLE_KEY, areaColorOf } from '../components/SharedWithMe/sharedWithMeLabels';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useFriendHub } from '../hooks/useFriendHub';
import { respondToInvitation } from '../api/notebookService';
import { requestNotesAccess } from '../api/socialNotesService';
import { blockUser, removeFriendship } from '../api/socialService';
import type { FriendHub } from '../api/socialHubService';
import { friendNotesPath, notebookEntryPath, sharedNotePath, socialTabPath } from '../lib/appLinks';
import { notifySocialChanged } from '../lib/socialEvents';
import { useI18n } from '../i18n/useI18n';

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
      <div>
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {hint && <p className="text-xs text-neutral-500">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function NoteLink({
  to,
  title,
  areaName,
  areaColor,
  badge,
}: {
  to: string;
  title: string;
  areaName: string;
  areaColor: string | null;
  badge: string;
}) {
  return (
    <li>
      <Link
        to={to}
        className="flex items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-2 transition-colors hover:border-violet-700"
      >
        <span className="flex min-w-0 items-center gap-2 text-sm text-neutral-200">
          <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: areaColorOf(areaColor) }} />
          <span className="truncate">{title}</span>
          <span className="hidden shrink-0 text-xs text-neutral-500 sm:inline">{areaName}</span>
        </span>
        <span className="shrink-0 text-xs text-neutral-400">{badge}</span>
      </Link>
    </li>
  );
}

// Tudo o que partilhas com UM amigo, nos dois sentidos: as notas dele que
// ves, o caderno dele, as tuas notas que ele ve e o teu caderno. Daqui
// abre-se cada nota, pede-se acesso e partilha-se uma nota nova.
export default function FriendProfile() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();
  const { hub, state, reload } = useFriendHub(userId);
  const [confirm, setConfirm] = useState<'remove' | 'block' | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const name = hub?.friend.name?.trim() || t('social.anonymous');
  useDocumentTitle(hub ? name : t('social.friends'));

  const crumbs = [
    { label: t('nav.social'), to: socialTabPath('friends') },
    { label: hub ? name : t('social.friends') },
  ];

  if (state === 'loading') {
    return (
      <PageLayout>
        <Breadcrumbs items={crumbs} />
        <CardGridSkeleton cards={3} />
      </PageLayout>
    );
  }
  if (state === 'not_friends' || state === 'error' || !hub) {
    return (
      <PageLayout>
        <Breadcrumbs items={crumbs} />
        <ErrorState message={state === 'not_friends' ? t('friend.notFriends') : t('friend.loadError')} />
      </PageLayout>
    );
  }

  const respond = async (requestId: string, accept: boolean) => {
    try {
      const { token } = await respondToInvitation(requestId, accept);
      notifySocialChanged();
      void reload();
      return { ok: true, token };
    } catch {
      return { ok: false, token: null };
    }
  };

  const askNotes = async () => {
    setIsAsking(true);
    try {
      await requestNotesAccess(hub.friend.userId);
      void reload();
    } finally {
      setIsAsking(false);
    }
  };

  const leave = async (action: 'remove' | 'block') => {
    if (action === 'remove') await removeFriendship(hub.friend.friendshipId);
    else await blockUser(hub.friend.userId);
    notifySocialChanged();
    navigate(socialTabPath('friends'));
  };

  const invitations = hub.sharedWithMe.filter((s) => s.invited);
  const theirNotes = hub.sharedWithMe.filter((s) => !s.invited);

  return (
    <PageLayout>
      <Breadcrumbs items={crumbs} />
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <PersonAvatar name={name} avatarUrl={hub.friend.avatarUrl} size="lg" />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold text-white">{name}</h1>
            <p className="text-sm text-neutral-500">
              {t('social.since', { date: new Date(hub.friend.since).toLocaleDateString(lang) })}
            </p>
          </div>
        </div>
        <ShareNoteWithFriend
          friendId={hub.friend.userId}
          friendName={name}
          alreadySharedIds={hub.sharedByMe.map((s) => s.entryId)}
          onInvited={() => void reload()}
        />
      </header>

      {invitations.length > 0 && (
        <section aria-label={t('sharedWithMe.invite.title')} className="mb-6 space-y-3">
          <h2 className="text-sm font-semibold text-white">{t('sharedWithMe.invite.title')}</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {invitations.map((s) => (
              <li key={s.token}>
                <InvitationCard
                  item={{
                    token: s.token,
                    status: 'PENDING',
                    role: s.role,
                    invited: true,
                    requestId: s.requestId,
                    title: s.title,
                    areaName: s.areaName,
                    areaColor: s.areaColor,
                    ownerName: hub.friend.name,
                    lastActivityAt: hub.friend.since,
                  }}
                  onRespond={respond}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title={t('friend.theirs.title', { name })} hint={t('friend.theirs.hint')}>
          <NotebookAccessRow hub={hub} name={name} isAsking={isAsking} onAsk={() => void askNotes()} />
          {theirNotes.length === 0 ? (
            <EmptyState message={t('friend.theirs.empty', { name })} />
          ) : (
            <ul className="space-y-1.5">
              {theirNotes.map((s) => (
                <NoteLink
                  key={s.token}
                  to={sharedNotePath(s.token)}
                  title={s.title}
                  areaName={s.areaName}
                  areaColor={s.areaColor}
                  badge={t(ROLE_KEY[s.role])}
                />
              ))}
            </ul>
          )}
        </Section>

        <Section title={t('friend.mine.title', { name })} hint={t('friend.mine.hint')}>
          <MyNotebookRow hub={hub} name={name} />
          {hub.sharedByMe.length === 0 ? (
            <EmptyState message={t('friend.mine.empty', { name })} />
          ) : (
            <ul className="space-y-1.5">
              {hub.sharedByMe.map((s) => (
                <NoteLink
                  key={s.requestId}
                  to={notebookEntryPath(s.entryId, { share: true })}
                  title={s.title}
                  areaName={s.areaName}
                  areaColor={s.areaColor}
                  badge={s.pending ? t('friend.mine.invitePending') : t(ROLE_KEY[s.role])}
                />
              ))}
            </ul>
          )}
        </Section>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-neutral-800 pt-4 text-sm">
        {confirm ? (
          <>
            <span className="text-neutral-400">
              {confirm === 'remove' ? t('friend.confirmRemove', { name }) : t('friend.confirmBlock', { name })}
            </span>
            <button
              type="button"
              onClick={() => void leave(confirm)}
              className="rounded-md bg-red-600/80 px-2.5 py-1 text-white hover:bg-red-600"
            >
              {confirm === 'remove' ? t('social.removeConfirm') : t('social.blockConfirm')}
            </button>
            <button type="button" onClick={() => setConfirm(null)} className="text-neutral-400 hover:text-white">
              {t('common.cancel')}
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => setConfirm('remove')} className="text-neutral-400 hover:text-red-400">
              {t('social.remove')}
            </button>
            <button type="button" onClick={() => setConfirm('block')} className="text-neutral-400 hover:text-red-400">
              {t('social.block')}
            </button>
          </>
        )}
      </div>
    </PageLayout>
  );
}

// O caderno inteiro do amigo (leitura por cadeiras): ler, pedido enviado ou pedir.
function NotebookAccessRow({
  hub,
  name,
  isAsking,
  onAsk,
}: {
  hub: FriendHub;
  name: string;
  isAsking: boolean;
  onAsk: () => void;
}) {
  const { t } = useI18n();
  const { status, areaCount } = hub.theirNotebook;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-sm">
      <span className="text-neutral-300">
        {status === 'APPROVED'
          ? t('friend.theirs.notebookOpen', { count: areaCount })
          : status === 'PENDING'
            ? t('friend.theirs.notebookPending', { name })
            : t('friend.theirs.notebookNone', { name })}
      </span>
      {status === 'APPROVED' ? (
        <Link to={friendNotesPath(hub.friend.userId)} className="font-medium text-violet-400 hover:text-violet-300">
          {t('social.notes.read')}
        </Link>
      ) : status === 'NONE' ? (
        <button
          type="button"
          disabled={isAsking}
          onClick={onAsk}
          className="rounded-md border border-neutral-700 px-2.5 py-1 text-neutral-200 hover:bg-neutral-800 disabled:opacity-50"
        >
          {t('social.notes.ask')}
        </button>
      ) : null}
    </div>
  );
}

// O teu caderno visto pelo amigo: o que ele pode ler e onde se muda.
function MyNotebookRow({ hub, name }: { hub: FriendHub; name: string }) {
  const { t } = useI18n();
  const { status, areaCount } = hub.myNotebook;
  if (status === 'NONE') {
    return (
      <p className="rounded-lg border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-sm text-neutral-500">
        {t('friend.mine.notebookNone', { name })}
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-800 bg-neutral-950/40 px-3 py-2 text-sm">
      <span className="text-neutral-300">
        {status === 'APPROVED'
          ? t('friend.mine.notebookOpen', { name, count: areaCount })
          : t('friend.mine.notebookPending', { name })}
      </span>
      <Link
        to={socialTabPath(status === 'APPROVED' ? 'mine' : 'requests')}
        className="font-medium text-violet-400 hover:text-violet-300"
      >
        {status === 'APPROVED' ? t('social.notes.changeAreas') : t('friend.mine.decide')}
      </Link>
    </div>
  );
}
