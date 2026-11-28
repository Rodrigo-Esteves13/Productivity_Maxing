import { POLL_MS } from '../lib/pollIntervals';
import { useCallback } from 'react';
import {
  acceptFriendLink,
  acceptFriendRequest,
  blockUser,
  getSocialOverview,
  requestFriendCodeChange,
  removeFriendship,
  sendEmailFriendRequest,
  sendFriendRequest,
  setAllowEmailFriendRequests,
  unblockUser,
  type SocialOverview,
} from '../api/socialService';
import { useLivePolled } from './useLivePolled';
import * as bus from '../lib/bus';
import {
  HTTP_BAD_REQUEST,
  HTTP_NOT_FOUND,
  HTTP_TOO_MANY_REQUESTS,
  getApiCode,
  getApiMessage,
  getHttpStatus,
} from '../lib/httpError';
import { parseFriendInput } from '../lib/friendLink';
import type { EmailFriendOutcome } from '../components/Social/AddFriendForm';

export type AddFriendOutcome = 'PENDING' | 'ACCEPTED' | 'NOT_FOUND' | 'SELF' | 'LIMIT' | 'ERROR';
export type CodeRequestOutcome = 'SENT' | 'ALREADY_PENDING' | 'TOO_MANY' | 'INVALID' | 'ERROR';

// Codigo devolvido pelo backend (FriendCodeRequestsService) -> resultado.
const CODE_REQUEST_ERRORS: Record<string, CodeRequestOutcome> = {
  CODE_REQUEST_PENDING: 'ALREADY_PENDING',
  CODE_REQUEST_LIMIT: 'TOO_MANY',
};

export function useSocial() {
  // Pedidos novos aparecem sem refresh (push, voltar ao separador, polling).
  const { data, setData, isLoading, hasError, load, run, notifyActionError } = useLivePolled({
    fetcher: getSocialOverview,
    initial: null as SocialOverview | null,
    intervalMs: POLL_MS.social,
  });

  // Aceita o codigo ou um link de amizade colado (com assinatura valida o
  // link torna-vos logo amigos, como abri-lo).
  const addFriend = useCallback(
    async (codeOrLink: string): Promise<AddFriendOutcome> => {
      const parsed = parseFriendInput(codeOrLink);
      if (!parsed) return 'NOT_FOUND';
      try {
        const res = parsed.token
          ? await acceptFriendLink(parsed)
          : await sendFriendRequest(parsed.friendCode);
        await load(true);
        bus.emit('social:changed');
        return res.status;
      } catch (e) {
        const status = getHttpStatus(e);
        if (status === HTTP_NOT_FOUND) return 'NOT_FOUND';
        if (status === HTTP_BAD_REQUEST) {
          return getApiMessage(e, '').includes('yourself') ? 'SELF' : 'LIMIT';
        }
        return 'ERROR';
      }
    },
    [load],
  );

  const addFriendByEmail = useCallback(async (email: string): Promise<EmailFriendOutcome> => {
    try {
      await sendEmailFriendRequest(email);
      void load(true);
      return 'SENT';
    } catch (e) {
      // 400 = limites do proprio (pedidos pendentes, amigos); 429 = demasiados.
      const status = getHttpStatus(e);
      if (status === HTTP_BAD_REQUEST || status === HTTP_TOO_MANY_REQUESTS) return 'LIMIT';
      return 'ERROR';
    }
  }, [load]);

  const setAllowEmailRequests = useCallback(
    async (allow: boolean) => {
      setData((prev) => (prev ? { ...prev, allowEmailFriendRequests: allow } : prev));
      try {
        await setAllowEmailFriendRequests(allow);
      } catch {
        setData((prev) => (prev ? { ...prev, allowEmailFriendRequests: !allow } : prev));
        notifyActionError();
      }
    },
    [setData, notifyActionError],
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
        const code = getApiCode(e) ?? '';
        if (CODE_REQUEST_ERRORS[code]) {
          // Ja havia um pendente: mostra-o em vez de so dar erro.
          void load(true);
          return CODE_REQUEST_ERRORS[code];
        }
        return getHttpStatus(e) === HTTP_BAD_REQUEST ? 'INVALID' : 'ERROR';
      }
    },
    [load, setData],
  );

  return {
    reload: () => void load(),
    data,
    isLoading,
    hasError,
    addFriend,
    addFriendByEmail,
    setAllowEmailRequests,
    requestCodeChange,
    accept: (id: string) => run(() => acceptFriendRequest(id)),
    remove: (id: string) => run(() => removeFriendship(id)),
    block: (userId: string) => run(() => blockUser(userId)),
    unblock: (userId: string) => run(() => unblockUser(userId)),
  };
}
