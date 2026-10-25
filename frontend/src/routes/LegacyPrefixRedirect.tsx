import { Navigate, useLocation } from 'react-router-dom';

interface Props {
  from: string;
  to: string;
}

// Troca o prefixo de um caminho antigo pelo novo, mantendo o resto, a query
// (?code=...) e o hash. Para URLs renomeadas que ja circulam (convites,
// notificacoes, favoritos).
export default function LegacyPrefixRedirect({ from, to }: Props) {
  const { pathname, search, hash } = useLocation();
  const rest = pathname.startsWith(from) ? pathname.slice(from.length) : '';
  return <Navigate to={`${to}${rest}${search}${hash}`} replace />;
}
