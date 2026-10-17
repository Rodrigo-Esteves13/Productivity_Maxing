import { useCallback, useEffect, useState } from 'react';
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

export function useNotesAccess() {
  const [incoming, setIncoming] = useState<IncomingGrantsView>({ areas: [], grants: [] });
  const [outgoing, setOutgoing] = useState<OutgoingGrant[]>([]);

  const load = useCallback(async () => {
    try {
      const [inc, out] = await Promise.all([getIncomingGrants(), getOutgoingGrants()]);
      setIncoming(inc);
      setOutgoing(out);
    } catch {
      // falha passageira: mantem o que ja tinha
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
        await load();
        return true;
      } catch {
        return false;
      }
    },
    [load],
  );

  return {
    incoming,
    outgoing,
    request: (ownerId: string) => run(() => requestNotesAccess(ownerId)),
    decide: (grantId: string, approve: boolean, areaIds?: string[]) =>
      run(() => decideGrant(grantId, approve, areaIds)),
    updateAreas: (grantId: string, areaIds: string[]) => run(() => updateGrantAreas(grantId, areaIds)),
    remove: (grantId: string) => run(() => removeGrant(grantId)),
  };
}
