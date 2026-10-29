import PrefetchLink from '../UI/PrefetchLink';
import { ArrowRightIcon } from '../UI/Icons';
import { useI18n } from '../../i18n/useI18n';
import type { SiteLink } from '../../lib/siteMap';

export type RelatedLink = SiteLink;

// Faixa "Funciona com": diz o que da para fazer na outra pagina em vez de so
// o nome dela, para as ligacoes serem descobertas. As listas vivem no mapa
// (lib/siteMap.ts) e o PageTrail desenha-a em todas as paginas principais.
// No telemovel desliza na horizontal em vez de ocupar varias linhas.
export default function RelatedLinks({ links, className = 'mb-6' }: { links: RelatedLink[]; className?: string }) {
  const { t } = useI18n();
  return (
    <nav
      aria-label={t('related.label')}
      className={`-mx-4 flex min-w-0 max-w-full items-center gap-2 overflow-x-auto px-4 text-sm sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 ${className}`}
    >
      <span className="shrink-0 text-neutral-500">{t('related.label')}</span>
      {links.map((link) => (
        <PrefetchLink
          key={link.to + link.labelKey}
          to={link.to}
          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1 text-neutral-300 transition-colors hover:border-violet-500/60 hover:text-white"
        >
          {t(link.labelKey)}
          <ArrowRightIcon className="h-3.5 w-3.5 text-neutral-500" />
        </PrefetchLink>
      ))}
    </nav>
  );
}
