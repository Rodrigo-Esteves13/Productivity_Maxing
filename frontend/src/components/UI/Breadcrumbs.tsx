import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n/useI18n';

export interface Crumb {
  label: string;
  /** Sem `to` = pagina atual (ultimo elemento). */
  to?: string;
}

// "Social / Ana / Notas": onde estas e o caminho de volta, num clique.
// className substitui a margem por omissao (mb-3).
export default function Breadcrumbs({ items, className = 'mb-3' }: { items: Crumb[]; className?: string }) {
  const { t } = useI18n();
  return (
    <nav aria-label={t('ui.breadcrumbs')} className={`min-w-0 ${className}`}>
      <ol className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
            {index > 0 && (
              <span aria-hidden="true" className="text-neutral-600">
                /
              </span>
            )}
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
