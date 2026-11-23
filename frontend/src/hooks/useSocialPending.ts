import { POLL_MS } from '../lib/pollIntervals';
import { useCallback, useEffect, useState } from 'react';
import { getSocialPending, type SocialPendingCounts } from '../api/socialService';
import { onSocialChanged } from '../lib/socialEvents';
import { useLiveRefresh } from './useLiveRefresh';

// Polling de seguranca: o push e o regresso ao separador ja refrescam antes.
const SOCIAL_PENDING_POLL_MS = POLL_MS.socialPending;

/**
 * Quantas coisas esperam por uma resposta tua no Social (pedidos de amizade,
 * convites para notas, pedidos para ler as tuas notas). Falhas ficam caladas:
 * o contador e so uma ajuda, nunca bloqueia a navbar.
 */
export function useSocialPending(enabled: boolean): SocialPendingCounts | null {
  const [counts, setCounts] = useState<SocialPendingCounts | null>(null);

  const load = useCallback(() => {
    getSocialPending()
      .then(setCounts)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    load();
    return onSocialChanged(load);
  }, [enabled, load]);

  useLiveRefresh(load, { enabled, intervalMs: SOCIAL_PENDING_POLL_MS });

  // Depois de sair da conta nao fica o numero da sessao anterior.
  return enabled ? counts : null;
}
