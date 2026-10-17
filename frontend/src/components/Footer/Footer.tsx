import FooterBrand from './FooterBrand';
import FooterLinkGroup from './FooterLinkGroup';
import TechBadge from './TechBadge';
import FooterBottomBar from './FooterBottomBar';
import { REPO_URL, REPO_ISSUES_URL } from '../../lib/constants';
import { useI18n } from '../../i18n/useI18n';

const PRODUCT_LINKS = [
  { label: 'nav.dashboard', to: '/dashboard' },
  { label: 'nav.tasks', to: '/tasks' },
  { label: 'nav.focus', to: '/focus' },
  { label: 'nav.schedule', to: '/schedule' },
  { label: 'nav.notebook', to: '/notebook' },
  { label: 'nav.profile', to: '/profile' },
];

const RESOURCE_LINKS = [
  { label: 'footer.repo', href: REPO_URL },
  { label: 'footer.issue', href: REPO_ISSUES_URL },
];

const LEGAL_LINKS = [
  { label: 'footer.privacy', to: '/privacy' },
  { label: 'footer.terms', to: '/terms' },
  { label: 'footer.eula', to: '/eula' },
  { label: 'footer.dmca', to: '/dmca' },
];

const STACK = ['React', 'TypeScript', 'Tailwind v4', 'NestJS', 'Prisma', 'Supabase', 'Go Agent'];

export default function Footer() {
  const { t } = useI18n();
  return (
    <footer className="print-hide relative border-t border-neutral-800 bg-neutral-950">
      {/* Linha de brilho subtil no topo do footer, para separar bem do conteúdo */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr] gap-10">
          <FooterBrand />
          <FooterLinkGroup title={t('footer.product')} items={PRODUCT_LINKS} />
          <FooterLinkGroup title={t('footer.resources')} items={RESOURCE_LINKS} />
          <FooterLinkGroup title={t('footer.legal')} items={LEGAL_LINKS} />
        </div>

        <div className="mt-10 pt-6 border-t border-neutral-800/80">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-3">
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
    </footer>
  );
}
