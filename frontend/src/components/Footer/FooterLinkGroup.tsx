import { Link } from 'react-router-dom';

export interface FooterLinkItem {
  label: string;
  to?: string;
  href?: string;
}

interface FooterLinkGroupProps {
  title: string;
  items: FooterLinkItem[];
}

// Cada coluna do footer usa isto - se tiver "to" é rota interna, se tiver "href" é link externo
export default function FooterLinkGroup({ title, items }: FooterLinkGroupProps) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-3">
        {title}
      </h3>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.label}>
            {item.to ? (
              <Link
                to={item.to}
                className="text-sm text-neutral-400 hover:text-white transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <a
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-neutral-400 hover:text-white transition-colors"
              >
                {item.label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
