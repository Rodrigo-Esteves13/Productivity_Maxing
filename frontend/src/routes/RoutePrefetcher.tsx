import { useEffect } from 'react';
import { useAuth } from '../context/useAuth';
import { canPrefetch, whenIdle } from '../lib/lazyWithPreload';
import { PRIMARY_PAGES } from './pages';

// Depois de entrar, no tempo livre do browser, pre-carrega as paginas mais
// usadas: a primeira ida a cada uma ja nao mostra o esqueleto. Nada disto
// corre com "poupar dados" ou rede 2G.
export default function RoutePrefetcher() {
  const { isAuthenticated } = useAuth();
  useEffect(() => {
    if (!isAuthenticated || !canPrefetch()) return;
    return whenIdle(() => {
      for (const page of PRIMARY_PAGES) void page.preload().catch(() => undefined);
    });
  }, [isAuthenticated]);
  return null;
}
