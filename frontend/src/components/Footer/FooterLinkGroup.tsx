import { useLocation } from 'react-router-dom';
import PrefetchLink from '../UI/PrefetchLink';
import { useI18n } from '../../i18n/useI18n';

export interface FooterLinkItem {
  label: string;
  to?: string;
  href?: string;
  /** Acao em vez de link (ex: abrir o feedback). */
  onClick?: () => void;
}

interface FooterLinkGroupProps {
  title: string;
  items: FooterLinkItem[];
}

const LINK_CLASS = 'text-sm text-neutral-400 transition-colors hover:text-white';

// Cada coluna do footer: "to" = rota interna (marcada quando e a pagina
// atual), "href" = link externo, "onClick" = acao.
export default function FooterLinkGroup({ title, items }: FooterLinkGroupProps) {
  const { t } = useI18n();
  const { pathname, search } = useLocation();
  const here = `${pathname}${search}`;
  return (
    <div>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">{title}</h3>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.label}>
            {item.to ? (
              <PrefetchLink
                to={item.to}
                aria-current={item.to === here ? 'page' : undefined}
                className={`${LINK_CLASS} aria-[current=page]:text-violet-300`}
              >
                {t(item.label)}
              </PrefetchLink>
            ) : item.onClick ? (
              <button type="button" onClick={item.onClick} className={LINK_CLASS}>
                {t(item.label)}
              </button>
            ) : (
              <a href={item.href} target="_blank" rel="noreferrer" className={LINK_CLASS}>
                {t(item.label)}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
