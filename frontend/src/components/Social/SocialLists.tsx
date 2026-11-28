import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { SocialOverview } from '../../api/socialService';
import type { OutgoingGrant } from '../../api/socialNotesService';
import { useI18n } from '../../i18n/useI18n';
import { friendNotesPath, friendPath } from '../../lib/appLinks';
import { useFeedback } from '../../context/useFeedback';
import { useListSearch } from '../../hooks/useListSearch';
import { sortFriends, type FriendSort } from '../../lib/socialLists';
import Button from '../UI/Button';
import EmptyState from '../UI/EmptyState';
import SearchField from '../UI/SearchField';
import SegmentedControl from '../UI/SegmentedControl';
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
  /** Cancela um pedido pendente ou deixa de ler um caderno aprovado. */
  onRemoveGrant: (grantId: string) => Promise<boolean>;
}

const btn = 'text-sm text-neutral-400 hover:text-white pointer-coarse:min-h-11 pointer-coarse:min-w-11 disabled:opacity-50';
const dangerBtn = `${btn} hover:text-red-400`;
const OUTLINE_LINK =
  'rounded-md border border-neutral-700 px-2.5 py-1 text-sm text-neutral-200 hover:border-violet-700 hover:text-white pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center';

const FRIEND_SORTS: FriendSort[] = ['name', 'recent'];
const FRIEND_SORT_LABEL: Record<FriendSort, string> = {
  name: 'ux4social.sort.name',
  recent: 'ux4social.sort.recent',
};

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
  onRemoveGrant,
}: Props) {
  const { t, lang } = useI18n();
  const { notify, confirm: confirmDialog } = useFeedback();
  // Acoes em curso (por id): o botao fica desativado ate a resposta chegar,
  // para nao enviar duas vezes.
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const [friendSort, setFriendSort] = useState<FriendSort>('name');
  const search = useListSearch(data.friends, (f) => [f.name]);
  const sortedFriends = useMemo(() => sortFriends(search.filtered, friendSort), [search.filtered, friendSort]);

  const withBusy = async (id: string, action: () => Promise<boolean>): Promise<boolean> => {
    setBusy((prev) => new Set(prev).add(id));
    try {
      return await action();
    } finally {
      setBusy((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const nameOf = (userId: string): string =>
    data.friends.find((f) => f.userId === userId)?.name?.trim() || t('social.anonymous');

  const blockPerson = async (userId: string, name: string) => {
    const ok = await confirmDialog({
      title: t('ux4social.block.title', { name }),
      message: t('friend.confirmBlock', { name }),
      confirmLabel: t('social.blockConfirm'),
      tone: 'danger',
    });
    if (ok) await withBusy(`block:${userId}`, () => onBlock(userId));
  };

  const dropGrant = async (grantId: string, approved: boolean, name: string) => {
    const ok = await confirmDialog({
      title: t(approved ? 'safeActions.stopViewing.title' : 'safeActions.cancelRequest.title'),
      message: t(approved ? 'safeActions.stopViewing.message' : 'safeActions.cancelRequest.message', { name }),
      confirmLabel: t(approved ? 'safeActions.stopViewing.confirm' : 'safeActions.cancelRequest.confirm'),
      tone: approved ? 'danger' : 'default',
    });
    if (!ok) return;
    const done = await withBusy(`grant:${grantId}`, () => onRemoveGrant(grantId));
    if (done) notify(t(approved ? 'safeActions.stopViewing.done' : 'safeActions.cancelRequest.done'), 'success');
  };

  const notesControl = (friendId: string) => {
    const grant = outgoingGrants.find((g) => g.ownerId === friendId);
    const name = nameOf(friendId);
    if (grant?.status === 'APPROVED') {
      return (
        <>
          <Link
            to={friendNotesPath(friendId)}
            className="text-sm text-violet-400 hover:text-violet-300 pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center"
          >
            {t('social.notes.read')}
          </Link>
          <button
            type="button"
            disabled={busy.has(`grant:${grant.grantId}`)}
            onClick={() => void dropGrant(grant.grantId, true, name)}
            className={dangerBtn}
          >
            {t('safeActions.stopViewing.button')}
          </button>
        </>
      );
    }
    if (grant) {
      return (
        <>
          <span className="text-xs text-neutral-500">{t('social.notes.requested')}</span>
          <button
            type="button"
            disabled={busy.has(`grant:${grant.grantId}`)}
            onClick={() => void dropGrant(grant.grantId, false, name)}
            className={btn}
          >
            {t('safeActions.cancelRequest.button')}
          </button>
        </>
      );
    }
    return (
      <button
        type="button"
        disabled={busy.has(`ask:${friendId}`)}
        onClick={() => void withBusy(`ask:${friendId}`, () => onRequestNotes(friendId))}
        className={btn}
      >
        {t('social.notes.ask')}
      </button>
    );
  };

  const showFriends = sections.includes('friends') && data.friends.length > 0;

  return (
    <div className="space-y-6">
      <Section title={t('social.incoming')} count={sections.includes('incoming') ? data.incoming.length : 0}>
        {data.incoming.map((r) => {
          const rowBusy = busy.has(`req:${r.friendshipId}`) || busy.has(`block:${r.userId}`);
          return (
            <PersonRow key={r.friendshipId} person={r} subtitle={t('social.wantsToBeFriends')}>
              <Button
                size="sm"
                disabled={rowBusy}
                onClick={() => void withBusy(`req:${r.friendshipId}`, () => onAccept(r.friendshipId))}
              >
                {t('social.accept')}
              </Button>
              <button
                type="button"
                disabled={rowBusy}
                onClick={() => void withBusy(`req:${r.friendshipId}`, () => onRemove(r.friendshipId))}
                className={btn}
              >
                {t('social.decline')}
              </button>
              <button
                type="button"
                disabled={rowBusy}
                onClick={() => void blockPerson(r.userId, r.name?.trim() || t('social.anonymous'))}
                className={dangerBtn}
              >
                {t('social.block')}
              </button>
            </PersonRow>
          );
        })}
      </Section>

      <Section title={t('social.outgoing')} count={sections.includes('outgoing') ? data.outgoing.length : 0}>
        {data.outgoing.map((r) => (
          <PersonRow key={r.friendshipId} person={r} subtitle={t('social.waiting')}>
            <button
              type="button"
              disabled={busy.has(`req:${r.friendshipId}`)}
              onClick={() => void withBusy(`req:${r.friendshipId}`, () => onRemove(r.friendshipId))}
              className={btn}
            >
              {t('social.cancelRequest')}
            </button>
          </PersonRow>
        ))}
      </Section>

      {showFriends && (
        <div className="flex flex-wrap items-center gap-3">
          <SearchField value={search.query} onChange={search.setQuery} label={t('ux4social.friends.search')} />
          <SegmentedControl
            options={FRIEND_SORTS.map((value) => ({ value, label: t(FRIEND_SORT_LABEL[value]) }))}
            value={friendSort}
            onChange={setFriendSort}
            size="sm"
          />
          {search.isFiltering && (
            <span className="text-xs text-neutral-500">
              {t('search.count', { shown: sortedFriends.length, total: data.friends.length })}
            </span>
          )}
        </div>
      )}
      {showFriends && search.isFiltering && sortedFriends.length === 0 && (
        <EmptyState message={t('search.noResultsFor', { query: search.query.trim() })} />
      )}
      <Section title={t('social.friends')} count={sections.includes('friends') ? sortedFriends.length : 0}>
        {sortedFriends.map((f) => (
          <PersonRow
            key={f.friendshipId}
            person={f}
            to={friendPath(f.userId)}
            subtitle={t('social.since', { date: new Date(f.since).toLocaleDateString(lang) })}
          >
            <Link to={friendPath(f.userId)} className={OUTLINE_LINK}>
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
            <button
              type="button"
              disabled={busy.has(`unblock:${b.userId}`)}
              onClick={() => void withBusy(`unblock:${b.userId}`, () => onUnblock(b.userId))}
              className={btn}
            >
              {t('social.unblock')}
            </button>
          </PersonRow>
        ))}
      </Section>
    </div>
  );
}
