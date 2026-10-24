import { useNavigate } from 'react-router-dom';
import PageLayout from '../components/Layout/PageLayout';
import Button from '../components/UI/Button';
import useSeo from '../hooks/useSeo';
import { useI18n } from '../i18n/useI18n';

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

  return (
    <PageLayout>
      <div className="flex flex-col items-center text-center py-20 sm:py-28">
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
    </PageLayout>
  );
}
