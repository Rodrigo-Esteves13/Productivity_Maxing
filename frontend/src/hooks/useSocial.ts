import { useCallback, useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
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
import { useLiveRefresh } from './useLiveRefresh';
import { notifySocialChanged } from '../lib/socialEvents';
import { useFeedback } from '../context/useFeedback';
import { translateNow } from '../i18n/translate';
import { parseFriendInput } from '../lib/friendLink';
import type { EmailFriendOutcome } from '../components/Social/AddFriendForm';

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
  const { notify } = useFeedback();

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
        // Aceitar/recusar/remover/bloquear: o botao fica igual, por isso a
        // falha tem de se ver (antes o false era ignorado em todo o lado).
        notify(translateNow('social.actionError'), 'error');
        return false;
      }
    },
    [load, notify],
  );

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
        notifySocialChanged();
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

  const addFriendByEmail = useCallback(async (email: string): Promise<EmailFriendOutcome> => {
    try {
      await sendEmailFriendRequest(email);
      void load(true);
      return 'SENT';
    } catch (e) {
      // 400 = limites do proprio (pedidos pendentes, amigos); 429 = demasiados.
      if (isAxiosError(e) && (e.response?.status === 400 || e.response?.status === 429)) return 'LIMIT';
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
        notify(translateNow('social.actionError'), 'error');
      }
    },
    [notify],
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
    addFriendByEmail,
    setAllowEmailRequests,
    requestCodeChange,
    accept: (id: string) => run(() => acceptFriendRequest(id)),
    remove: (id: string) => run(() => removeFriendship(id)),
    block: (userId: string) => run(() => blockUser(userId)),
    unblock: (userId: string) => run(() => unblockUser(userId)),
  };
}
