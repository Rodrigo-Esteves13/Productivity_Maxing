import { Link, useLocation } from 'react-router-dom';
import SectionMenu from '../Layout/SectionMenu';
import { useI18n } from '../../i18n/useI18n';
import { owningPage, type SiteSection } from '../../lib/siteMap';

export interface Crumb {
  label: string;
  /** Sem `to` = pagina atual (ultimo elemento). */
  to?: string;
}

const Separator = () => (
  <span aria-hidden="true" className="text-neutral-600">
    /
  </span>
);

// "Em conjunto / Social / Ana / Notas": onde estas e o caminho de volta,
// num clique. A secao a frente vem do mapa (lib/siteMap.ts) e abre as
// paginas irmas: pelo caminho atual (/classes/x e de Classes) ou, se o
// mapa nao o tiver (/packs/x), pelo link mais fundo do trilho, que e o
// pai mais proximo. section={null} tira-a.
// className substitui a margem por omissao (mb-3).
export default function Breadcrumbs({
  items,
  className = 'mb-3',
  section,
}: {
  items: Crumb[];
  className?: string;
  section?: SiteSection | null;
}) {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const deepestLink = [...items].reverse().find((item) => item.to)?.to;
  const resolvedSection =
    section === undefined
      ? (owningPage(pathname) ?? (deepestLink ? owningPage(deepestLink) : undefined))?.section
      : section;

  return (
    <nav aria-label={t('ui.breadcrumbs')} className={`min-w-0 ${className}`}>
      <ol className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
        {resolvedSection && (
          <li className="flex items-center">
            <SectionMenu section={resolvedSection} />
          </li>
        )}
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
            {(index > 0 || resolvedSection) && <Separator />}
            {item.to ? (
              <Link to={item.to} className="truncate text-violet-400 hover:text-violet-300 hover:underline">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="truncate text-neutral-300">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
