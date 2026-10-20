import { lazy, Suspense, useState } from 'react';
import FooterBrand from './FooterBrand';
import FooterLinkGroup, { type FooterLinkItem } from './FooterLinkGroup';
import TechBadge from './TechBadge';
import FooterBottomBar from './FooterBottomBar';
import { REPO_URL, REPO_ISSUES_URL } from '../../lib/constants';
import { socialTabPath } from '../../lib/appLinks';
import { useAuth } from '../../context/useAuth';
import { useI18n } from '../../i18n/useI18n';

// Lazy: so carrega quando alguem carrega em "Enviar feedback".
const FeedbackModal = lazy(() => import('../Feedback/FeedbackModal'));

const STUDY_LINKS: FooterLinkItem[] = [
  { label: 'nav.dashboard', to: '/dashboard' },
  { label: 'nav.tasks', to: '/tasks' },
  { label: 'nav.focus', to: '/focus' },
  { label: 'nav.schedule', to: '/schedule' },
  { label: 'nav.notebook', to: '/notebook' },
  { label: 'nav.areas', to: '/areas' },
  { label: 'nav.review', to: '/review' },
];

const SOCIAL_LINKS: FooterLinkItem[] = [
  { label: 'social.tab.friends', to: socialTabPath('friends') },
  { label: 'social.tab.requests', to: socialTabPath('requests') },
  { label: 'nav.sharedWithMe', to: socialTabPath('shared') },
  { label: 'social.tab.mine', to: socialTabPath('mine') },
  { label: 'nav.taskPacks', to: '/task-packs' },
];

// Sem sessao os links da app so levavam ao login: mostra-se logo o comeco.
const GET_STARTED_LINKS: FooterLinkItem[] = [
  { label: 'auth.login', to: '/login' },
  { label: 'auth.createAccount', to: '/register' },
];

const LEGAL_LINKS: FooterLinkItem[] = [
  { label: 'footer.privacy', to: '/privacy' },
  { label: 'footer.terms', to: '/terms' },
  { label: 'footer.eula', to: '/eula' },
  { label: 'footer.dmca', to: '/dmca' },
];

const STACK = ['React', 'TypeScript', 'Tailwind v4', 'NestJS', 'Prisma', 'Supabase', 'Go Agent'];

export default function Footer() {
  const { t } = useI18n();
  const { isAuthenticated } = useAuth();
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  const helpLinks: FooterLinkItem[] = [
    { label: 'nav.changelog', to: '/changelog' },
    ...(isAuthenticated ? [{ label: 'feedback.open', onClick: () => setIsFeedbackOpen(true) }] : []),
    { label: 'footer.issue', href: REPO_ISSUES_URL },
    { label: 'footer.repo', href: REPO_URL },
    ...(isAuthenticated
      ? [
          { label: 'nav.agent', to: '/agent' },
          { label: 'nav.developer', to: '/developer' },
        ]
      : []),
  ];

  return (
    <footer className="print-hide relative border-t border-neutral-800 bg-neutral-950">
      {/* Linha de brilho subtil no topo do footer, para separar bem do conteúdo */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* No telemovel as colunas de links ficam duas a duas em vez de uma
            lista enorme; a marca ocupa a linha toda. */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
          <div className="col-span-2 md:col-span-1">
            <FooterBrand />
          </div>
          {isAuthenticated ? (
            <>
              <FooterLinkGroup title={t('footer.study')} items={STUDY_LINKS} />
              <FooterLinkGroup title={t('footer.socialGroup')} items={SOCIAL_LINKS} />
            </>
          ) : (
            <FooterLinkGroup title={t('footer.getStarted')} items={GET_STARTED_LINKS} />
          )}
          <FooterLinkGroup title={t('footer.help')} items={helpLinks} />
          <FooterLinkGroup title={t('footer.legal')} items={LEGAL_LINKS} />
        </div>

        <div className="mt-10 border-t border-neutral-800/80 pt-6">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            {t('footer.builtWith')}
          </h3>
          <div className="flex flex-wrap gap-2">
            {STACK.map((tech) => (
              <TechBadge key={tech} label={tech} />
            ))}
          </div>
        </div>

        <div className="mt-8">
          <FooterBottomBar />
        </div>
      </div>

      {isFeedbackOpen && (
        <Suspense fallback={null}>
          <FeedbackModal isOpen onClose={() => setIsFeedbackOpen(false)} />
        </Suspense>
      )}
    </footer>
  );
}
