import { POLL_MS } from '../lib/pollIntervals';
import { useCallback, useEffect, useState } from 'react';
import { getMyShares, type MyShare } from '../api/socialHubService';
import { useLiveRefresh } from './useLiveRefresh';
import { onSocialChanged } from '../lib/socialEvents';

/** As tuas notas partilhadas, com quem as ve e o que espera pela tua decisao. */
export function useMyShares({ enabled = true }: { enabled?: boolean } = {}) {
  const [items, setItems] = useState<MyShare[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const load = useCallback(async (silent: boolean) => {
    if (!silent) setIsLoading(true);
    try {
      setItems(await getMyShares());
      setHasError(false);
    } catch {
      if (!silent) setHasError(true);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) void load(false);
  }, [enabled, load]);

  // Pedidos novos pelo link aparecem sem F5 (push + polling de seguranca).
  useLiveRefresh(() => void load(true), { enabled, intervalMs: POLL_MS.myShares });
  // Acao noutro cartao do Social (ex: aceitar um pedido de notas): le de novo
  // em silencio. O GET repetido pelo proprio emissor junta-se no dedupe.
  useEffect(() => {
    if (!enabled) return;
    return onSocialChanged(() => void load(true));
  }, [enabled, load]);

  const waitingCount = items.reduce((sum, s) => sum + s.pendingRequests + s.pendingProposals, 0);
  return { items, isLoading, hasError, waitingCount };
}
