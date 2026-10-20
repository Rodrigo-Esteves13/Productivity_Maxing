import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import PageLayout from '../components/Layout/PageLayout';
import Breadcrumbs from '../components/UI/Breadcrumbs';
import ErrorState from '../components/UI/ErrorState';
import CardGridSkeleton from '../components/UI/CardGridSkeleton';
import PersonAvatar from '../components/Social/PersonAvatar';
import RoleBadge from '../components/Users/RoleBadge';
import UserStatusBadge from '../components/Users/UserStatusBadge';
import AdminFriendCodeCard from '../components/Users/AdminFriendCodeCard';
import AdminPersonList from '../components/Users/AdminPersonList';
import {
  getAdminSocialProfile,
  regenerateFriendCode,
  type AdminSocialProfile,
  type AdminSharedPerson,
} from '../api/adminSocialService';
import { useAuth } from '../context/useAuth';
import { useFeedback } from '../context/useFeedback';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useI18n } from '../i18n/useI18n';

const ROLE_KEY: Record<AdminSharedPerson['roles'][number], string> = {
  VIEWER: 'sharedWithMe.role.viewer',
  EDITOR: 'sharedWithMe.role.editor',
  CO_OWNER: 'sharedWithMe.role.coOwner',
};

// A partir daqui a lista de amigos ganha filtro.
const FILTER_FROM = 8;

type LoadState = 'loading' | 'ready' | 'not_found' | 'error';

// Admin: perfil social de uma conta. Codigo de amigo (gerar novo quando
// quiser) e todas as ligacoes com outras pessoas; cada pessoa abre o perfil
// dela, para seguir a rede de amizades.
export default function AdminUserProfile() {
  const { userId = '' } = useParams<{ userId: string }>();
  const { t, lang } = useI18n();
  const { user: me } = useAuth();
  const { notify, confirm } = useFeedback();
  const [profile, setProfile] = useState<AdminSocialProfile | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [filter, setFilter] = useState('');

  const name = profile ? profile.user.name?.trim() || profile.user.email : '';
  useDocumentTitle(name || t('adminSocial.title'));

  const load = useCallback(async () => {
    try {
      setProfile(await getAdminSocialProfile(userId));
      setState('ready');
    } catch (error) {
      setState(axios.isAxiosError(error) && error.response?.status === 404 ? 'not_found' : 'error');
    }
  }, [userId]);

  // Mudar de perfil (clicar num amigo) recomeca do zero.
  useEffect(() => {
    setState('loading');
    setProfile(null);
    setFilter('');
    void load();
  }, [load]);

  const regenerate = async () => {
    if (!profile) return;
    const ok = await confirm({
      title: t('adminSocial.code.confirmTitle'),
      message: t('adminSocial.code.confirmMessage', { name }),
      confirmLabel: profile.friendCode ? t('adminSocial.code.regenerate') : t('adminSocial.code.generate'),
    });
    if (!ok) return;
    setIsRegenerating(true);
    try {
      await regenerateFriendCode(profile.user.userId);
      // Recarrega: o pedido pendente (se havia) passa a aprovado.
      await load();
      notify(t('adminSocial.code.done'), 'success');
    } catch {
      notify(t('adminSocial.code.error'), 'error');
    } finally {
      setIsRegenerating(false);
    }
  };

  const friends = useMemo(() => {
    const all = profile?.friends ?? [];
    const query = filter.trim().toLocaleLowerCase();
    if (!query) return all;
    return all.filter((f) => `${f.name ?? ''} ${f.email}`.toLocaleLowerCase().includes(query));
  }, [profile, filter]);

  const date = (iso: string) => new Date(iso).toLocaleDateString(lang);
  const sharedDetail = (p: AdminSharedPerson) =>
    `${t('adminSocial.items', { count: p.items })} · ${p.roles.map((r) => t(ROLE_KEY[r])).join(', ')}`;

  const crumbs = [{ label: t('ui.userManagement'), to: '/users' }, { label: name || t('adminSocial.title') }];

  if (state === 'loading') {
    return (
      <PageLayout>
        <Breadcrumbs items={crumbs} />
        <CardGridSkeleton cards={4} />
      </PageLayout>
    );
  }
  if (state !== 'ready' || !profile) {
    return (
      <PageLayout>
        <Breadcrumbs items={crumbs} />
        <ErrorState message={state === 'not_found' ? t('adminSocial.notFound') : t('adminSocial.loadError')} />
      </PageLayout>
    );
  }

  const { user } = profile;
  const pendingCount = profile.incoming.length + profile.outgoing.length;
  const blockCount = profile.blocked.length + profile.blockedBy.length;
  const notesCount =
    profile.readers.length + profile.reading.length + profile.sharedWith.length + profile.sharedBy.length;
  const stats = [
    { label: t('adminSocial.stats.friends'), value: profile.friends.length, href: '#friends' },
    { label: t('adminSocial.stats.pending'), value: pendingCount, href: '#requests' },
    { label: t('adminSocial.stats.blocks'), value: blockCount, href: '#blocks' },
    { label: t('adminSocial.stats.notes'), value: notesCount, href: '#notes' },
  ];

  return (
    <PageLayout>
      <Breadcrumbs items={crumbs} />

      <header className="flex flex-wrap items-center gap-4 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 sm:p-5">
        <PersonAvatar name={name} avatarUrl={user.avatarUrl} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold text-white">{name}</h1>
          <p className="truncate text-sm text-neutral-400">{user.email}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
            <RoleBadge role={user.role} />
            <UserStatusBadge status={user.status} />
            <span>{t('adminSocial.joined', { date: date(user.createdAt) })}</span>
            {me?.id === user.userId && <span className="text-violet-400">{t('ui.thatSYou')}</span>}
          </div>
        </div>
      </header>

      <nav aria-label={t('adminSocial.summary')} className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map((s) => (
          <a
            key={s.href}
            href={s.href}
            className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3 transition-colors hover:border-violet-800"
          >
            <span className="block text-2xl font-bold tabular-nums text-white">{s.value}</span>
            <span className="block text-xs text-neutral-400">{s.label}</span>
          </a>
        ))}
      </nav>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <AdminFriendCodeCard
          code={profile.friendCode}
          requests={profile.codeRequests}
          isRegenerating={isRegenerating}
          onRegenerate={() => void regenerate()}
        />

        <section id="friends" className="scroll-mt-20 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 sm:p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-100">
            {t('adminSocial.friends')}
            <span className="rounded-full bg-neutral-800 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-300">
              {profile.friends.length}
            </span>
          </h2>
          {profile.friends.length > FILTER_FROM && (
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t('adminSocial.filter')}
              aria-label={t('adminSocial.filter')}
              className="mb-3 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white placeholder:text-neutral-600 focus:border-violet-500 focus:outline-none"
            />
          )}
          <AdminPersonList
            people={friends}
            empty={filter ? t('adminSocial.filterEmpty') : t('adminSocial.friendsEmpty')}
            detail={(p) => t('adminSocial.since', { date: date(p.at) })}
          />
        </section>

        <section id="requests" className="scroll-mt-20 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 sm:p-5">
          <h2 className="mb-3 text-sm font-semibold text-neutral-100">{t('adminSocial.requests')}</h2>
          <div className="space-y-4">
            <AdminPersonList
              title={t('adminSocial.incoming')}
              people={profile.incoming}
              empty={t('adminSocial.none')}
              detail={(p) => t('adminSocial.requestedOn', { date: date(p.at) })}
            />
            <AdminPersonList
              title={t('adminSocial.outgoing')}
              people={profile.outgoing}
              empty={t('adminSocial.none')}
              detail={(p) => t('adminSocial.requestedOn', { date: date(p.at) })}
            />
          </div>
        </section>

        <section id="blocks" className="scroll-mt-20 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 sm:p-5">
          <h2 className="mb-3 text-sm font-semibold text-neutral-100">{t('adminSocial.blocks')}</h2>
          <div className="space-y-4">
            <AdminPersonList
              title={t('adminSocial.blocked')}
              people={profile.blocked}
              empty={t('adminSocial.none')}
              detail={(p) => t('adminSocial.blockedOn', { date: date(p.at) })}
            />
            <AdminPersonList
              title={t('adminSocial.blockedBy')}
              people={profile.blockedBy}
              empty={t('adminSocial.none')}
              detail={(p) => t('adminSocial.blockedOn', { date: date(p.at) })}
            />
          </div>
        </section>

        <section
          id="notes"
          className="scroll-mt-20 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 sm:p-5 lg:col-span-2"
        >
          <h2 className="text-sm font-semibold text-neutral-100">{t('adminSocial.notes')}</h2>
          <p className="mb-3 mt-0.5 text-xs text-neutral-500">{t('adminSocial.notesHint')}</p>
          <div className="grid gap-4 md:grid-cols-2">
            <AdminPersonList
              title={t('adminSocial.readers')}
              people={profile.readers}
              empty={t('adminSocial.none')}
              detail={(p) =>
                p.grantStatus === 'PENDING'
                  ? t('adminSocial.grantPending')
                  : t('adminSocial.areaCount', { count: p.areaCount })
              }
            />
            <AdminPersonList
              title={t('adminSocial.reading')}
              people={profile.reading}
              empty={t('adminSocial.none')}
              detail={(p) =>
                p.grantStatus === 'PENDING'
                  ? t('adminSocial.grantPending')
                  : t('adminSocial.areaCount', { count: p.areaCount })
              }
            />
            <AdminPersonList
              title={t('adminSocial.sharedWith')}
              people={profile.sharedWith}
              empty={t('adminSocial.none')}
              detail={sharedDetail}
            />
            <AdminPersonList
              title={t('adminSocial.sharedBy')}
              people={profile.sharedBy}
              empty={t('adminSocial.none')}
              detail={sharedDetail}
            />
          </div>
        </section>
      </div>
    </PageLayout>
  );
}
