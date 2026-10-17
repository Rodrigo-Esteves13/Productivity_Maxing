import { useCallback, useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import {
  acceptFriendRequest,
  blockUser,
  getSocialOverview,
  regenerateFriendCode,
  removeFriendship,
  sendFriendRequest,
  unblockUser,
  type SocialOverview,
} from '../api/socialService';
import { useLiveRefresh } from './useLiveRefresh';

export type AddFriendOutcome = 'PENDING' | 'ACCEPTED' | 'NOT_FOUND' | 'SELF' | 'LIMIT' | 'ERROR';

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

  const newCode = useCallback(
    () => run(async () => regenerateFriendCode()),
    [run],
  );

  return {
    data,
    isLoading,
    hasError,
    addFriend,
    newCode,
    accept: (id: string) => run(() => acceptFriendRequest(id)),
    remove: (id: string) => run(() => removeFriendship(id)),
    block: (userId: string) => run(() => blockUser(userId)),
    unblock: (userId: string) => run(() => unblockUser(userId)),
  };
}
