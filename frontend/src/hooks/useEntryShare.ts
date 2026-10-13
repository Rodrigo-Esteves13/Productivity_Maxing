import { useCallback, useEffect, useState } from 'react';
import {
  getShareStatus,
  createShare,
  revokeShare,
  updateShareVisibility,
  getShareAccessRequests,
  decideShareAccessRequest,
} from '../api/notebookService';
import type { NotebookShareVisibility, ShareAccessRequest } from '../types/models';

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
  open: () => Promise<void>;
  close: () => void;
  create: () => Promise<void>;
  revoke: () => Promise<void>;
  changeVisibility: (next: NotebookShareVisibility) => Promise<void>;
  decide: (requestId: string, decision: 'APPROVED' | 'DENIED') => Promise<void>;
}

// Estado do painel "Share" de uma entrada. Vive NUM HOOK chamado pelo
// wrapper do editor (NotebookEntryEditor), fora do formulario que remonta no
// "Cancel" - antes o estado vivia dentro do painel, por isso cancelar uma
// edicao (ou gravar) fechava o painel e perdia o link/pedidos carregados.
export function useEntryShare(entryId: string): UseEntryShareResult {
  const [isOpen, setIsOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<NotebookShareVisibility>('PUBLIC');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [requests, setRequests] = useState<ShareAccessRequest[]>([]);
  const [isRequestsLoading, setIsRequestsLoading] = useState(false);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  // Repoe tudo ao trocar de entrada - o token de uma nao pode "vazar" para o
  // painel de outra enquanto o estado carrega.
  useEffect(() => {
    setIsOpen(false);
    setToken(null);
    setVisibility('PUBLIC');
    setError('');
    setRequests([]);
  }, [entryId]);

  const shareUrl = token ? `${window.location.origin}/shared/${token}` : '';
  const pendingCount = requests.filter((r) => r.status === 'PENDING').length;

  const loadRequests = useCallback(async () => {
    setIsRequestsLoading(true);
    try {
      setRequests(await getShareAccessRequests(entryId));
    } catch {
      // Painel secundario - um erro aqui nao deve esconder o link em si.
    } finally {
      setIsRequestsLoading(false);
    }
  }, [entryId]);

  const open = useCallback(async () => {
    setIsOpen(true);
    setIsLoading(true);
    setError('');
    try {
      const status = await getShareStatus(entryId);
      setToken(status.token);
      setVisibility(status.visibility);
      if (status.token && status.visibility === 'AUTHORIZED') await loadRequests();
    } catch {
      setError('Could not check the share status.');
    } finally {
      setIsLoading(false);
    }
  }, [entryId, loadRequests]);

  const close = useCallback(() => setIsOpen(false), []);

  const create = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const status = await createShare(entryId);
      setToken(status.token);
      setVisibility(status.visibility);
    } catch {
      setError('Could not create the share link.');
    } finally {
      setIsLoading(false);
    }
  }, [entryId]);

  const revoke = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      await revokeShare(entryId);
      setToken(null);
      setRequests([]);
    } catch {
      setError('Could not stop sharing.');
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
        if (status.visibility === 'AUTHORIZED') await loadRequests();
      } catch {
        setError('Could not change who can access this link.');
      } finally {
        setIsLoading(false);
      }
    },
    [entryId, visibility, loadRequests],
  );

  const decide = useCallback(
    async (requestId: string, decision: 'APPROVED' | 'DENIED') => {
      setDecidingId(requestId);
      try {
        const updated = await decideShareAccessRequest(entryId, requestId, decision);
        setRequests((prev) => prev.map((r) => (r.id === requestId ? { ...r, status: updated.status } : r)));
      } catch {
        setError('Could not update that request. Please try again.');
      } finally {
        setDecidingId(null);
      }
    },
    [entryId],
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
    open,
    close,
    create,
    revoke,
    changeVisibility,
    decide,
  };
}
