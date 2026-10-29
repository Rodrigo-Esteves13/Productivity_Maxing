import { useNavigate } from 'react-router-dom';
import PageLayout from '../components/Layout/PageLayout';
import Button from '../components/UI/Button';
import PrefetchLink from '../components/UI/PrefetchLink';
import { navGroups } from '../components/Navbar/navItems';
import useSeo from '../hooks/useSeo';
import { useAuth } from '../context/useAuth';
import { useI18n } from '../i18n/useI18n';
import { SECTION_LABEL_KEY } from '../lib/siteMap';

// Com sessao, o 404 mostra o mapa da app (as mesmas secoes do menu e do
// rodape): quem caiu num link morto escolhe logo para onde ia.
const GROUPS = navGroups();

// Was previously a silent <Navigate to="/" replace /> in AppRouter - any
// mistyped or dead link just bounced straight to the homepage with no
// feedback, which also meant Google/Search Console had no way to tell a
// broken link from a working redirect. This is a real, noindex'd 404 view.
// Note: since this is a client-only SPA with Netlify's catch-all "/* ->
// /index.html 200" rewrite, the server response is still a 200 even on a
// bad URL - there's no way around that without server rendering. The
// `noindex` meta tag + explicit "Page not found" content is the standard
// mitigation search engines expect from JS-rendered sites (a documented
// "soft 404" pattern), not a limitation specific to this fix.
export default function NotFound() {
  const { t } = useI18n();
  useSeo({
    title: t('common.notFound.title'),
    description: t('ui.thisPageDoesntExistOr'),
    path: '/404',
    noindex: true,
  });
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  return (
    <PageLayout>
      <div className="flex flex-col items-center text-center py-16 sm:py-24">
        <p className="text-sm font-semibold text-violet-400 tracking-wide">404</p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-bold text-white tracking-tight">
          {t('common.notFound.title')}
        </h1>
        <p className="mt-4 max-w-md text-neutral-400">
          {t('common.notFound.body')}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Button size="lg" onClick={() => navigate('/')}>
            {t('common.notFound.home')}
          </Button>
          <Button variant="secondary" size="lg" onClick={() => navigate(-1)}>
            {t('common.notFound.back')}
          </Button>
        </div>
      </div>
      {isAuthenticated && (
        <nav aria-labelledby="not-found-map" className="mx-auto mb-16 max-w-4xl border-t border-neutral-800 pt-8">
          <h2 id="not-found-map" className="mb-6 text-center text-sm font-medium text-neutral-400">
            {t('map.allPagesTitle')}
          </h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
            {GROUPS.map((group) => (
              <section key={group.section} aria-labelledby={`not-found-${group.section}`}>
                <h3
                  id={`not-found-${group.section}`}
                  className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500"
                >
                  {t(SECTION_LABEL_KEY[group.section])}
                </h3>
                <ul className="space-y-2 text-sm">
                  {group.items.map((item) => (
                    <li key={item.to}>
                      <PrefetchLink to={item.to} className="text-neutral-300 transition-colors hover:text-white">
                        {t(item.labelKey)}
                      </PrefetchLink>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </nav>
      )}
    </PageLayout>
  );
}
