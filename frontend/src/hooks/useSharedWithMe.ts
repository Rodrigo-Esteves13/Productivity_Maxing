import { useCallback } from 'react';
import { getSharedWithMe, respondToInvitation, type SharedWithMeItem } from '../api/notebookShareService';
import { useLivePolled } from './useLivePolled';
import * as bus from '../lib/bus';

/** ok=false se falhou; token da nota quando aceitou (para a abrir logo). */
export interface InvitationAnswer {
  ok: boolean;
  token: string | null;
}

export interface UseSharedWithMeResult {
  items: SharedWithMeItem[];
  isLoading: boolean;
  hasError: boolean;
  /** Aceitar/recusar um convite. */
  respond: (requestId: string, accept: boolean) => Promise<InvitationAnswer>;
}

// Polling de seguranca por omissao (o push e voltar ao separador ja refrescam).
const DEFAULT_POLL_MS = 15000;
const NO_ITEMS: SharedWithMeItem[] = [];

export function useSharedWithMe({ intervalMs = DEFAULT_POLL_MS }: { intervalMs?: number } = {}): UseSharedWithMeResult {
  // Um pedido pendente passa a aprovado sem F5 (push + polling).
  const { data: items, isLoading, hasError, load } = useLivePolled({
    fetcher: getSharedWithMe,
    initial: NO_ITEMS,
    intervalMs,
  });

  const respond = useCallback(
    async (requestId: string, accept: boolean): Promise<InvitationAnswer> => {
      try {
        const { token } = await respondToInvitation(requestId, accept);
        bus.emit('social:changed');
        void load(true);
        return { ok: true, token };
      } catch {
        return { ok: false, token: null };
      }
    },
    [load],
  );

  return { items, isLoading, hasError, respond };
}
