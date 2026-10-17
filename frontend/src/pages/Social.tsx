import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import ErrorState from '../components/UI/ErrorState';
import EmptyState from '../components/UI/EmptyState';
import LoadingState from '../components/UI/LoadingState';
import FriendCodeCard from '../components/Social/FriendCodeCard';
import AddFriendForm from '../components/Social/AddFriendForm';
import NotesAccessPanel from '../components/Social/NotesAccessPanel';
import SocialLists from '../components/Social/SocialLists';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useSocial } from '../hooks/useSocial';
import { useNotesAccess } from '../hooks/useNotesAccess';
import { useI18n } from '../i18n/useI18n';

export default function Social() {
  const { t } = useI18n();
  useDocumentTitle(t('nav.social'));
  const notes = useNotesAccess();
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
          <p className="text-xs text-neutral-600">{t('social.privacy')}</p>
        </div>
      )}
    </PageLayout>
  );
}
