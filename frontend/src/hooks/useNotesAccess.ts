import { POLL_MS } from '../lib/pollIntervals';
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
import { useLivePolled } from './useLivePolled';

interface NotesAccess {
  incoming: IncomingGrantsView;
  outgoing: OutgoingGrant[];
}

const NO_ACCESS: NotesAccess = { incoming: { areas: [], grants: [] }, outgoing: [] };

async function fetchNotesAccess(): Promise<NotesAccess> {
  const [incoming, outgoing] = await Promise.all([getIncomingGrants(), getOutgoingGrants()]);
  return { incoming, outgoing };
}

export function useNotesAccess() {
  // hasError so quando nunca carregou: sem isto o separador Pedidos dizia
  // "nada por decidir" com pedidos de notas pendentes. Uma falha passageira
  // depois disso mantem o que ja havia.
  const { data, hasError, run } = useLivePolled({
    fetcher: fetchNotesAccess,
    initial: NO_ACCESS,
    intervalMs: POLL_MS.notesAccess,
  });
  const { incoming, outgoing } = data;

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
