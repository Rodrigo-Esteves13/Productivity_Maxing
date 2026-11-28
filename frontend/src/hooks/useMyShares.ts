import { POLL_MS } from '../lib/pollIntervals';
import { getMyShares, type MyShare } from '../api/socialHubService';
import { useLivePolled } from './useLivePolled';

const NO_SHARES: MyShare[] = [];

/** As tuas notas partilhadas, com quem as ve e o que espera pela tua decisao. */
export function useMyShares({ enabled = true }: { enabled?: boolean } = {}) {
  // Pedidos novos pelo link aparecem sem F5 (push + polling de seguranca).
  const { data: items, isLoading, hasError } = useLivePolled({
    fetcher: getMyShares,
    initial: NO_SHARES,
    intervalMs: POLL_MS.myShares,
    enabled,
  });

  const waitingCount = items.reduce((sum, s) => sum + s.pendingRequests + s.pendingProposals, 0);
  return { items, isLoading, hasError, waitingCount };
}
