import { useNavigate } from 'react-router-dom';
import PageLayout from '../components/Layout/PageLayout';
import Button from '../components/UI/Button';
import FaqSection from '../components/Home/FaqSection';
import StickyMobileCta from '../components/Home/StickyMobileCta';
import useSeo from '../hooks/useSeo';
import { useI18n } from '../i18n/useI18n';

const HOME_DESCRIPTION =
  'Free task and grade tracker for academic life. Organize subjects into Areas, track deadlines and ' +
  'difficulty, and compare target vs real grades - with optional Google Calendar sync.';

// Module-level constant so the reference (and its string content) stays
// stable across renders - useSeo compares jsonLd by value, so this avoids
// re-running the head-mutation effect on every Home re-render for no reason.
const HOME_JSON_LD = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Productivity Maxing',
  applicationCategory: 'ProductivityApplication',
  operatingSystem: 'Web',
  description: HOME_DESCRIPTION,
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'EUR',
  },
});

// Homepage pública. Necessária para o Google OAuth (brand verification):
// tem de existir uma homepage pública, no mesmo domínio da app, que descreva
// a funcionalidade e linke Privacy Policy + Terms (o Footer já trata disso).
export default function Home() {
  const { t } = useI18n();
  useSeo({
    description: HOME_DESCRIPTION,
    path: '/',
    jsonLd: HOME_JSON_LD,
  });
  const navigate = useNavigate();

  return (
    <PageLayout>
      <div className="flex flex-col items-center text-center py-16 sm:py-24">
        <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight">
          Productivity <span className="text-violet-400">Maxing</span>
        </h1>
        <p className="mt-5 max-w-xl text-neutral-400 text-lg">
          {t('ui.taskAndGradeTrackerFor')}
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Button className="px-6 py-3 text-base" onClick={() => navigate('/register')}>
            {t('ui.getStartedForFree')}
          </Button>
          <Button variant="secondary" className="px-6 py-3 text-base" onClick={() => navigate('/login')}>
            {t('ui.logIn')}
          </Button>
        </div>

        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl w-full text-left">
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6">
            <h3 className="font-semibold text-white mb-1">Areas & Tasks</h3>
            <p className="text-sm text-neutral-400">
              {t('ui.groupYourWorkBySubject')}
            </p>
          </div>
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6">
            <h3 className="font-semibold text-white mb-1">Grades & Deadlines</h3>
            <p className="text-sm text-neutral-400">
              {t('ui.setATargetGradeAnd')}
            </p>
          </div>
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6">
            <h3 className="font-semibold text-white mb-1">Streaks & Progress</h3>
            <p className="text-sm text-neutral-400">
              {t('ui.aDashboardThatKeepsTrack')}
            </p>
          </div>
        </div>

        <FaqSection />
      </div>

      {/* Fora do <div> de texto centrado de propósito - é fixed, não deve
          herdar/ser afetado pelo layout de fluxo do hero acima dele. */}
      <StickyMobileCta />
    </PageLayout>
  );
}
