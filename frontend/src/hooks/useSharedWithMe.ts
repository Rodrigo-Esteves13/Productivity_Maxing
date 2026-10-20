import { useCallback, useEffect, useState } from 'react';
import { getSharedWithMe, respondToInvitation, type SharedWithMeItem } from '../api/notebookService';
import { useLiveRefresh } from './useLiveRefresh';
import { notifySocialChanged } from '../lib/socialEvents';

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

export function useSharedWithMe({ intervalMs = DEFAULT_POLL_MS }: { intervalMs?: number } = {}): UseSharedWithMeResult {
  const [items, setItems] = useState<SharedWithMeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const load = useCallback(async (silent: boolean) => {
    if (!silent) setIsLoading(true);
    try {
      setItems(await getSharedWithMe());
      setHasError(false);
    } catch {
      if (!silent) setHasError(true);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  // Um pedido pendente passa a aprovado sem F5 (push + polling).
  useLiveRefresh(() => void load(true), { enabled: true, intervalMs });

  const respond = useCallback(
    async (requestId: string, accept: boolean): Promise<InvitationAnswer> => {
      try {
        const { token } = await respondToInvitation(requestId, accept);
        notifySocialChanged();
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
