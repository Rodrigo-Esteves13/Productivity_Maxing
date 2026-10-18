import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import ErrorState from '../components/UI/ErrorState';
import EmptyState from '../components/UI/EmptyState';
import LoadingState from '../components/UI/LoadingState';
import FriendCodeCard from '../components/Social/FriendCodeCard';
import AddFriendForm from '../components/Social/AddFriendForm';
import NotesAccessPanel from '../components/Social/NotesAccessPanel';
import SocialLists from '../components/Social/SocialLists';
import SharedWithMeList from '../components/SharedWithMe/SharedWithMeList';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useSocial } from '../hooks/useSocial';
import { useNotesAccess } from '../hooks/useNotesAccess';
import { useSharedWithMe } from '../hooks/useSharedWithMe';
import { useI18n } from '../i18n/useI18n';

export default function Social() {
  const { t } = useI18n();
  useDocumentTitle(t('nav.social'));
  const notes = useNotesAccess();
  const shared = useSharedWithMe();
  const invitations = shared.items.filter((item) => item.invited);
  const rest = shared.items.filter((item) => !item.invited);
  const { data, isLoading, hasError, addFriend, newCode, accept, remove, block, unblock } = useSocial();

  const isEmpty =
    data !== null &&
    data.friends.length + data.incoming.length + data.outgoing.length + data.blocked.length === 0;

  return (
    <PageLayout>
      <PageHeader title={t('nav.social')} description={t('social.description')} />
      {isLoading ? (
        <LoadingState message={t('common.loading')} />
      ) : hasError || !data ? (
        <ErrorState message={t('social.loadError')} />
      ) : (
        <div className="space-y-6">
          {invitations.length > 0 && (
            <section aria-label={t('sharedWithMe.invite.title')} className="space-y-3">
              <h2 className="text-sm font-semibold text-white">{t('sharedWithMe.invite.title')}</h2>
              <SharedWithMeList items={invitations} onRespond={shared.respond} />
            </section>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <FriendCodeCard code={data.friendCode} onRegenerate={newCode} />
            <AddFriendForm onAdd={addFriend} />
          </div>
          {isEmpty ? (
            <EmptyState message={t('social.empty')} />
          ) : (
            <>
              <NotesAccessPanel
                view={notes.incoming}
                onDecide={notes.decide}
                onUpdateAreas={notes.updateAreas}
                onRevoke={notes.remove}
              />
              <SocialLists
                data={data}
                onAccept={accept}
                onRemove={remove}
                onBlock={block}
                onUnblock={unblock}
                outgoingGrants={notes.outgoing}
                onRequestNotes={notes.request}
              />
            </>
          )}
          <section aria-label={t('nav.sharedWithMe')} className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-white">{t('nav.sharedWithMe')}</h2>
              <p className="text-xs text-neutral-500">{t('sharedWithMe.description')}</p>
            </div>
            {shared.isLoading ? (
              <LoadingState message={t('common.loading')} />
            ) : shared.hasError ? (
              <ErrorState message={t('sharedWithMe.error')} />
            ) : rest.length === 0 ? (
              <EmptyState message={t('sharedWithMe.empty')} />
            ) : (
              <SharedWithMeList items={rest} onRespond={shared.respond} />
            )}
          </section>
          <p className="text-xs text-neutral-600">{t('social.privacy')}</p>
        </div>
      )}
    </PageLayout>
  );
}
