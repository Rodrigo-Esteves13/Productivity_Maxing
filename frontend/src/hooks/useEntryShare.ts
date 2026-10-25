import { useCallback, useEffect, useState } from 'react';
import { useLiveRefresh } from './useLiveRefresh';
import {
  getShareStatus,
  createShare,
  revokeShare,
  updateShareVisibility,
  getShareAccessRequests,
  decideShareAccessRequest,
  inviteFriendToEntry,
  removeShareAccess,
  getChangeProposals,
  getShareVisits,
  decideChangeProposal,
} from '../api/notebookService';
import type {
  ShareVisits,
  ChangeProposal,
  ChangeProposalFields,
  NotebookShareVisibility,
  ShareAccessRequest,
  ShareAccessRole,
} from '../types/models';
import { translateNow } from '../i18n/translate';
import { getApiCode } from '../lib/httpError';

// 409 do convite com causa conhecida (notebook-invite.service.ts).
const INVITE_CONFLICT_KEY: Record<string, string> = {
  INVITE_NOTE_FULL: 'friend.share.noteFull',
  INVITE_DECLINED_RECENTLY: 'friend.share.declinedRecently',
};

export interface UseEntryShareResult {
  isOpen: boolean;
  token: string | null;
  visibility: NotebookShareVisibility;
  isLoading: boolean;
  error: string;
  shareUrl: string;
  requests: ShareAccessRequest[];
  pendingCount: number;
  isRequestsLoading: boolean;
  decidingId: string | null;
  proposals: ChangeProposal[];
  decidingProposalId: string | null;
  visits: ShareVisits | null;
  visitsError: boolean;
  open: () => Promise<void>;
  close: () => void;
  create: () => Promise<void>;
  revoke: () => Promise<void>;
  changeVisibility: (next: NotebookShareVisibility) => Promise<void>;
  decide: (requestId: string, decision: 'APPROVED' | 'DENIED', role?: ShareAccessRole) => Promise<void>;
  decideProposal: (proposalId: string, decision: 'APPROVED' | 'REJECTED') => Promise<void>;
  invite: (friendId: string, role: ShareAccessRole) => Promise<boolean>;
  removeAccess: (requestId: string) => Promise<void>;
}

// O painel Share lembra-se de como o deixaste: depois de o abrires pela
// primeira vez fica aberto em todas as entradas, até o fechares no X.
const PANEL_OPEN_KEY = 'pmaxing.sharePanelOpen';

function readPanelPreference(): boolean {
  try {
    return localStorage.getItem(PANEL_OPEN_KEY) === '1';
  } catch {
    return false;
  }
}

function writePanelPreference(open: boolean): void {
  try {
    localStorage.setItem(PANEL_OPEN_KEY, open ? '1' : '0');
  } catch {
    // sem storage: o painel só lembra-se durante a sessão
  }
}

/** Links diretos (?share=1, avisos push): a proxima entrada abre com o painel aberto. */
export function rememberSharePanelOpen(): void {
  writePanelPreference(true);
}

// Estado do painel "Share" de uma entrada. Vive NUM HOOK chamado pelo
// wrapper do editor (NotebookEntryEditor), fora do formulario que remonta no
// "Cancel" - antes o estado vivia dentro do painel, por isso cancelar uma
// edicao (ou gravar) fechava o painel e perdia o link/pedidos carregados.
//
// `onProposalApplied` avisa o editor quando uma proposta e aprovada: o
// servidor mudou o titulo/notas, e o rascunho local tem de os receber - senao
// o proximo auto save repunha o texto antigo por cima.
export function useEntryShare(
  entryId: string,
  onProposalApplied?: (fields: ChangeProposalFields) => void,
): UseEntryShareResult {
  const [isOpen, setIsOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<NotebookShareVisibility>('PUBLIC');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [requests, setRequests] = useState<ShareAccessRequest[]>([]);
  const [isRequestsLoading, setIsRequestsLoading] = useState(false);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [proposals, setProposals] = useState<ChangeProposal[]>([]);
  const [decidingProposalId, setDecidingProposalId] = useState<string | null>(null);
  const [visits, setVisits] = useState<ShareVisits | null>(null);
  const [visitsError, setVisitsError] = useState(false);

  // Repoe tudo ao trocar de entrada - o token de uma nao pode "vazar" para o
  // painel de outra enquanto o estado carrega.
  useEffect(() => {
    setIsOpen(false);
    setToken(null);
    setVisibility('PUBLIC');
    setError('');
    setRequests([]);
    setProposals([]);
    setVisits(null);
    setVisitsError(false);
  }, [entryId]);

  const shareUrl = token ? `${window.location.origin}/shared/${token}` : '';
  const pendingCount = requests.filter((r) => r.status === 'PENDING' && !r.invitedByOwner).length;

  const loadRequests = useCallback(async (silent = false) => {
    if (!silent) setIsRequestsLoading(true);
    try {
      const [requestList, proposalList] = await Promise.all([
        getShareAccessRequests(entryId),
        getChangeProposals(entryId),
      ]);
      setRequests(requestList);
      setProposals(proposalList);
    } catch {
      // Painel secundario - um erro aqui nao deve esconder o link em si.
    } finally {
      if (!silent) setIsRequestsLoading(false);
    }
  }, [entryId]);

  const loadVisits = useCallback(async () => {
    try {
      setVisits(await getShareVisits(entryId));
      setVisitsError(false);
    } catch {
      setVisitsError(true);
    }
  }, [entryId]);

  const open = useCallback(async () => {
    writePanelPreference(true);
    setIsOpen(true);
    setIsLoading(true);
    setError('');
    try {
      const status = await getShareStatus(entryId);
      setToken(status.token);
      setVisibility(status.visibility);
      if (status.token) void loadVisits();
      // Carrega mesmo em Publico: pedidos/propostas antigos continuam
      // pendentes e contam nos badges, por isso tem de se poder decidir.
      if (status.token) await loadRequests();
    } catch {
      setError(translateNow('hook.couldNotCheckTheShareStatus'));
    } finally {
      setIsLoading(false);
    }
  }, [entryId, loadRequests, loadVisits]);

  const close = useCallback(() => {
    writePanelPreference(false);
    setIsOpen(false);
  }, []);

  // Abre sozinho nas entradas seguintes se foi assim que o deixaste.
  useEffect(() => {
    if (readPanelPreference()) void open();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryId]);

  // Novos pedidos/propostas aparecem sem F5 (push + polling de seguranca).
  useLiveRefresh(() => void loadRequests(true), {
    enabled: isOpen && token !== null,
    intervalMs: 15000,
  });

  const create = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const status = await createShare(entryId);
      setToken(status.token);
      setVisibility(status.visibility);
      void loadVisits();
    } catch {
      setError(translateNow('hook.couldNotCreateTheShareLink'));
    } finally {
      setIsLoading(false);
    }
  }, [entryId, loadVisits]);

  const revoke = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      await revokeShare(entryId);
      setToken(null);
      setRequests([]);
      setProposals([]);
      setVisits(null);
    } catch {
      setError(translateNow('hook.couldNotStopSharing'));
    } finally {
      setIsLoading(false);
    }
  }, [entryId]);

  const changeVisibility = useCallback(
    async (next: NotebookShareVisibility) => {
      if (next === visibility) return;
      setIsLoading(true);
      setError('');
      try {
        const status = await updateShareVisibility(entryId, next);
        setVisibility(status.visibility);
        await loadRequests();
      } catch {
        setError(translateNow('hook.couldNotChangeWhoCanAccess'));
      } finally {
        setIsLoading(false);
      }
    },
    [entryId, visibility, loadRequests],
  );

  const decide = useCallback(
    async (requestId: string, decision: 'APPROVED' | 'DENIED', role?: ShareAccessRole) => {
      setDecidingId(requestId);
      try {
        const updated = await decideShareAccessRequest(entryId, requestId, decision, role);
        setRequests((prev) =>
          prev.map((r) => (r.id === requestId ? { ...r, status: updated.status, accessRole: updated.accessRole } : r)),
        );
      } catch {
        setError(translateNow('hook.couldNotUpdateThatRequestPlease'));
      } finally {
        setDecidingId(null);
      }
    },
    [entryId],
  );

  // Convida um amigo (ele tem de aceitar). Devolve true se o convite foi criado.
  const invite = useCallback(
    async (friendId: string, role: ShareAccessRole): Promise<boolean> => {
      setError('');
      try {
        await inviteFriendToEntry(entryId, friendId, role);
        await loadRequests(true);
        return true;
      } catch (caught) {
        setError(translateNow(INVITE_CONFLICT_KEY[getApiCode(caught) ?? ''] ?? 'hook.couldNotInviteThatFriendThey'));
        return false;
      }
    },
    [entryId, loadRequests],
  );

  const removeAccess = useCallback(
    async (requestId: string) => {
      setDecidingId(requestId);
      try {
        await removeShareAccess(entryId, requestId);
        setRequests((prev) => prev.filter((r) => r.id !== requestId));
      } catch {
        setError(translateNow('hook.couldNotRemoveThatAccessPlease'));
      } finally {
        setDecidingId(null);
      }
    },
    [entryId],
  );

  const decideProposal = useCallback(
    async (proposalId: string, decision: 'APPROVED' | 'REJECTED') => {
      const proposal = proposals.find((p) => p.id === proposalId);
      setDecidingProposalId(proposalId);
      try {
        await decideChangeProposal(entryId, proposalId, decision);
        setProposals((prev) => prev.filter((p) => p.id !== proposalId));
        if (decision === 'APPROVED' && proposal) onProposalApplied?.(proposal.payload);
      } catch {
        setError(translateNow('hook.couldNotUpdateThatSuggestionPlease'));
      } finally {
        setDecidingProposalId(null);
      }
    },
    [entryId, proposals, onProposalApplied],
  );

  return {
    isOpen,
    token,
    visibility,
    isLoading,
    error,
    shareUrl,
    requests,
    pendingCount,
    isRequestsLoading,
    decidingId,
    proposals,
    decidingProposalId,
    visits,
    visitsError,
    open,
    close,
    create,
    revoke,
    changeVisibility,
    decide,
    decideProposal,
    invite,
    removeAccess,
  };
}
