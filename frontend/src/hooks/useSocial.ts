import { useCallback, useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import {
  acceptFriendRequest,
  blockUser,
  getSocialOverview,
  requestFriendCodeChange,
  removeFriendship,
  sendFriendRequest,
  unblockUser,
  type SocialOverview,
} from '../api/socialService';
import { useLiveRefresh } from './useLiveRefresh';
import { notifySocialChanged } from '../lib/socialEvents';

export type AddFriendOutcome = 'PENDING' | 'ACCEPTED' | 'NOT_FOUND' | 'SELF' | 'LIMIT' | 'ERROR';
export type CodeRequestOutcome = 'SENT' | 'ALREADY_PENDING' | 'TOO_MANY' | 'INVALID' | 'ERROR';

// Codigo devolvido pelo backend (FriendCodeRequestsService) -> resultado.
const CODE_REQUEST_ERRORS: Record<string, CodeRequestOutcome> = {
  CODE_REQUEST_PENDING: 'ALREADY_PENDING',
  CODE_REQUEST_LIMIT: 'TOO_MANY',
};
const HTTP_BAD_REQUEST = 400;

export function useSocial() {
  const [data, setData] = useState<SocialOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      setData(await getSocialOverview());
      setHasError(false);
    } catch {
      if (!silent) setHasError(true);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Pedidos novos aparecem sem refresh (push, voltar ao separador, polling).
  useLiveRefresh(() => void load(true), { enabled: true, intervalMs: 20000 });

  const run = useCallback(
    async (action: () => Promise<unknown>): Promise<boolean> => {
      try {
        await action();
        notifySocialChanged();
        await load(true);
        return true;
      } catch {
        return false;
      }
    },
    [load],
  );

  const addFriend = useCallback(
    async (code: string): Promise<AddFriendOutcome> => {
      try {
        const res = await sendFriendRequest(code);
        await load(true);
        return res.status;
      } catch (e) {
        if (isAxiosError(e)) {
          if (e.response?.status === 404) return 'NOT_FOUND';
          if (e.response?.status === 400) {
            const msg = String((e.response.data as { message?: unknown })?.message ?? '');
            return msg.includes('yourself') ? 'SELF' : 'LIMIT';
          }
        }
        return 'ERROR';
      }
    },
    [load],
  );

  // O cartao passa logo a "pendente" com a resposta do POST; o recarregar
  // a seguir e so para ficar em dia (se falhar, o pedido ja esta criado).
  const requestCodeChange = useCallback(
    async (reason: string): Promise<CodeRequestOutcome> => {
      try {
        const created = await requestFriendCodeChange(reason);
        setData((prev) => (prev ? { ...prev, codeChangeRequest: created } : prev));
        void load(true);
        return 'SENT';
      } catch (e) {
        if (!isAxiosError(e)) return 'ERROR';
        const code = String((e.response?.data as { code?: unknown })?.code ?? '');
        if (CODE_REQUEST_ERRORS[code]) {
          // Ja havia um pendente: mostra-o em vez de so dar erro.
          void load(true);
          return CODE_REQUEST_ERRORS[code];
        }
        return e.response?.status === HTTP_BAD_REQUEST ? 'INVALID' : 'ERROR';
      }
    },
    [load],
  );

  return {
    data,
    isLoading,
    hasError,
    addFriend,
    requestCodeChange,
    accept: (id: string) => run(() => acceptFriendRequest(id)),
    remove: (id: string) => run(() => removeFriendship(id)),
    block: (userId: string) => run(() => blockUser(userId)),
    unblock: (userId: string) => run(() => unblockUser(userId)),
  };
}
