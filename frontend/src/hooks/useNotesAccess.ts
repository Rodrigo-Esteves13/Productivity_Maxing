import { useCallback, useEffect, useRef, useState } from 'react';
import {
  decideGrant,
  getIncomingGrants,
  getOutgoingGrants,
  removeGrant,
  requestNotesAccess,
  updateGrantAreas,
  type IncomingGrantsView,
  type OutgoingGrant,
} from '../api/socialNotesService';
import { useLiveRefresh } from './useLiveRefresh';
import { notifySocialChanged } from '../lib/socialEvents';
import { useFeedback } from '../context/useFeedback';
import { translateNow } from '../i18n/translate';

export function useNotesAccess() {
  const [incoming, setIncoming] = useState<IncomingGrantsView>({ areas: [], grants: [] });
  const [outgoing, setOutgoing] = useState<OutgoingGrant[]>([]);
  // true enquanto nunca carregou: sem isto o separador Pedidos dizia "nada
  // por decidir" com pedidos de notas pendentes.
  const [hasError, setHasError] = useState(false);
  const loadedRef = useRef(false);
  const { notify } = useFeedback();

  const load = useCallback(async () => {
    try {
      const [inc, out] = await Promise.all([getIncomingGrants(), getOutgoingGrants()]);
      setIncoming(inc);
      setOutgoing(out);
      loadedRef.current = true;
      setHasError(false);
    } catch {
      // falha passageira depois de ja ter carregado: mantem o que ja tinha
      if (!loadedRef.current) setHasError(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  useLiveRefresh(() => void load(), { enabled: true, intervalMs: 20000 });

  const run = useCallback(
    async (action: () => Promise<unknown>): Promise<boolean> => {
      try {
        await action();
        notifySocialChanged();
        await load();
        return true;
      } catch {
        notify(translateNow('social.actionError'), 'error');
        return false;
      }
    },
    [load, notify],
  );

  return {
    incoming,
    outgoing,
    hasError,
    request: (ownerId: string) => run(() => requestNotesAccess(ownerId)),
    decide: (grantId: string, approve: boolean, areaIds?: string[]) =>
      run(() => decideGrant(grantId, approve, areaIds)),
    updateAreas: (grantId: string, areaIds: string[]) => run(() => updateGrantAreas(grantId, areaIds)),
    remove: (grantId: string) => run(() => removeGrant(grantId)),
  };
}
