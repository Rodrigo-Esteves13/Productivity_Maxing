import { Link, useSearchParams } from 'react-router-dom';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import ErrorState from '../components/UI/ErrorState';
import EmptyState from '../components/UI/EmptyState';
import CardGridSkeleton from '../components/UI/CardGridSkeleton';
import LinesSkeleton from '../components/UI/LinesSkeleton';
import TabBar from '../components/UI/TabBar';
import FriendCodeCard from '../components/Social/FriendCodeCard';
import AddFriendForm from '../components/Social/AddFriendForm';
import NotesAccessPanel from '../components/Social/NotesAccessPanel';
import SocialLists, { type SocialListSection } from '../components/Social/SocialLists';
import MySharesList from '../components/Social/MySharesList';
import SharedWithMeList from '../components/SharedWithMe/SharedWithMeList';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useSocial } from '../hooks/useSocial';
import { useNotesAccess } from '../hooks/useNotesAccess';
import { useSharedWithMe } from '../hooks/useSharedWithMe';
import { useMyShares } from '../hooks/useMyShares';
import { useI18n } from '../i18n/useI18n';
import type { SocialTab } from '../lib/appLinks';

const TABS: SocialTab[] = ['requests', 'friends', 'shared', 'mine'];
const isSocialTab = (value: string | null): value is SocialTab => TABS.includes(value as SocialTab);

// Social = pessoas + tudo o que partilham. Quatro separadores (com ?tab= no
// URL, para os avisos push e os outros ecras abrirem o certo): Pedidos (o
// que espera por ti), Amigos, Partilhado comigo e As minhas partilhas.
export default function Social() {
  const { t } = useI18n();
  useDocumentTitle(t('nav.social'));
  const [searchParams, setSearchParams] = useSearchParams();
  const notes = useNotesAccess();
  const shared = useSharedWithMe();
  const mine = useMyShares();
  const { data, isLoading, hasError, addFriend, requestCodeChange, accept, remove, block, unblock } = useSocial();

  const invitations = shared.items.filter((item) => item.invited);
  const sharedItems = shared.items.filter((item) => !item.invited);
  const notesRequests = notes.incoming.grants.filter((g) => g.status === 'PENDING').length;
  const requestsCount = invitations.length + (data?.incoming.length ?? 0) + notesRequests;

  // Sem ?tab: abre nos Pedidos se algo espera por ti, senao nos Amigos. So
  // decide depois de carregar, para nao saltar de separador a meio.
  const tabParam = searchParams.get('tab');
  const isReady = !isLoading && !shared.isLoading;
  const tab: SocialTab | null = isSocialTab(tabParam)
    ? tabParam
    : isReady
      ? requestsCount > 0
        ? 'requests'
        : 'friends'
      : null;
  const changeTab = (next: SocialTab) => setSearchParams({ tab: next }, { replace: true });

  const lists = (sections: SocialListSection[]) =>
    data && (
      <SocialLists
        data={data}
        sections={sections}
        onAccept={accept}
        onRemove={remove}
        onBlock={block}
        onUnblock={unblock}
        outgoingGrants={notes.outgoing}
        onRequestNotes={notes.request}
      />
    );

  return (
    <PageLayout>
      <PageHeader title={t('nav.social')} description={t('social.description')} />
      {tab === null && <CardGridSkeleton cards={3} />}
      {tab !== null && (
        <TabBar
          label={t('nav.social')}
          value={tab}
          onChange={changeTab}
          className="mb-6"
          items={[
            {
              value: 'requests',
              label: t('social.tab.requests'),
              alert: requestsCount,
              alertLabel: t('nav.socialPending', { count: requestsCount }),
            },
            { value: 'friends', label: t('social.tab.friends'), count: data?.friends.length },
            { value: 'shared', label: t('social.tab.shared'), count: sharedItems.length },
            {
              value: 'mine',
              label: t('social.tab.mine'),
              count: mine.items.length,
              alert: mine.waitingCount,
              alertLabel: t('social.mine.waiting', { count: mine.waitingCount }),
            },
          ]}
        />
      )}

      {tab === 'requests' && (
        <div role="tabpanel" className="space-y-6">
          {/* Convites para notas primeiro, mesmo que o resto do Social ainda
              esteja a carregar ou falhe. */}
          {invitations.length > 0 && (
            <section aria-label={t('sharedWithMe.invite.title')} className="space-y-3">
              <h2 className="text-sm font-semibold text-white">{t('sharedWithMe.invite.title')}</h2>
              <SharedWithMeList items={invitations} onRespond={shared.respond} />
            </section>
          )}
          {isLoading ? (
            <LinesSkeleton lines={3} />
          ) : hasError || !data ? (
            <ErrorState message={t('social.loadError')} />
          ) : (
            <>
              {lists(['incoming'])}
              <NotesAccessPanel
                view={notes.incoming}
                status="PENDING"
                title={t('social.notes.title')}
                onDecide={notes.decide}
                onUpdateAreas={notes.updateAreas}
                onRevoke={notes.remove}
              />
              {notes.hasError && <ErrorState message={t('social.notes.loadError')} />}
              {requestsCount === 0 && !notes.hasError && <EmptyState message={t('social.requests.empty')} />}
              {lists(['outgoing'])}
            </>
          )}
        </div>
      )}

      {tab === 'friends' && (
        <div role="tabpanel">
          {isLoading ? (
            <CardGridSkeleton cards={3} />
          ) : hasError || !data ? (
            <ErrorState message={t('social.loadError')} />
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FriendCodeCard code={data.friendCode} request={data.codeChangeRequest} onRequestChange={requestCodeChange} />
                <AddFriendForm onAdd={addFriend} />
              </div>
              {data.friends.length === 0 ? (
                <EmptyState
                  message={t('social.emptyWithClasses')}
                  action={
                    <Link to="/classes" className="text-sm font-medium text-violet-400 hover:text-violet-300">
                      {t('social.openClasses')}
                    </Link>
                  }
                />
              ) : (
                lists(['friends'])
              )}
              {lists(['blocked'])}
              <p className="text-xs text-neutral-500">{t('social.privacy')}</p>
            </div>
          )}
        </div>
      )}

      {tab === 'shared' && (
        <section role="tabpanel" aria-label={t('nav.sharedWithMe')} className="space-y-3">
          <p className="text-xs text-neutral-500">{t('sharedWithMe.description')}</p>
          {shared.isLoading ? (
            <LinesSkeleton lines={3} />
          ) : shared.hasError ? (
            <ErrorState message={t('sharedWithMe.error')} />
          ) : sharedItems.length === 0 ? (
            <EmptyState message={t('sharedWithMe.empty')} />
          ) : (
            <>
              <SharedWithMeList items={sharedItems} onRespond={shared.respond} />
              {sharedItems.length >= SOCIAL_LIST_LIMIT && <ListLimitNote />}
            </>
          )}
        </section>
      )}

      {tab === 'mine' && (
        <div role="tabpanel" className="space-y-6">
          <section aria-label={t('social.mine.title')} className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-white">{t('social.mine.title')}</h2>
              <p className="text-xs text-neutral-500">{t('social.mine.description')}</p>
            </div>
            {mine.isLoading ? (
              <LinesSkeleton lines={3} />
            ) : mine.hasError ? (
              <ErrorState message={t('social.mine.error')} />
            ) : mine.items.length === 0 ? (
              <EmptyState message={t('social.mine.empty')} />
            ) : (
              <>
                <MySharesList items={mine.items} />
                {mine.items.length >= SOCIAL_LIST_LIMIT && <ListLimitNote />}
              </>
            )}
          </section>
          <NotesAccessPanel
            view={notes.incoming}
            status="APPROVED"
            title={t('social.notes.readers')}
            onDecide={notes.decide}
            onUpdateAreas={notes.updateAreas}
            onRevoke={notes.remove}
          />
        </div>
      )}
    </PageLayout>
  );
}

// O backend devolve no maximo MAX_ITEMS (100) por lista
// (notebook-social-hub.service.ts, notebook-shared-with-me.service.ts).
// Chegando ao limite diz-se que ha mais, em vez de as mais antigas
// desaparecerem sem aviso.
const SOCIAL_LIST_LIMIT = 100;

function ListLimitNote() {
  const { t } = useI18n();
  return <p className="text-xs text-neutral-500">{t('social.listLimit', { count: SOCIAL_LIST_LIMIT })}</p>;
}
