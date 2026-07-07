import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface LegalLinkProps {
  href: string;
  children: ReactNode;
  /** false para rotas internas (usa <Link>), true (default) para externas/mailto */
  external?: boolean;
}

export default function LegalLink({ href, children, external = true }: LegalLinkProps) {
  const className = 'underline text-violet-400 hover:text-violet-300';

  if (!external) {
    return (
      <Link to={href} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <a href={href} target="_blank" rel="noreferrer" className={className}>
      {children}
    </a>
  );
}