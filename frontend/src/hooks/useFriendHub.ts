import { useCallback, useEffect, useState } from 'react';
import { getFriendHub, type FriendHub } from '../api/socialHubService';
import { getHttpStatus } from '../lib/httpError';
import { useLiveRefresh } from './useLiveRefresh';

const HTTP_NOT_FOUND = 404;

export type FriendHubState = 'loading' | 'ready' | 'not_friends' | 'error';

/** Tudo o que partilhas com um amigo, refrescado sozinho (push + polling). */
export function useFriendHub(userId: string | undefined) {
  const [hub, setHub] = useState<FriendHub | null>(null);
  const [state, setState] = useState<FriendHubState>('loading');

  const load = useCallback(
    async (silent: boolean) => {
      if (!userId) return;
      if (!silent) setState('loading');
      try {
        setHub(await getFriendHub(userId));
        setState('ready');
      } catch (caught) {
        // Deixaram de ser amigos (ou nunca foram): 404 do servidor.
        if (getHttpStatus(caught) === HTTP_NOT_FOUND) {
          setHub(null);
          setState('not_friends');
        } else if (!silent) {
          setState('error');
        }
      }
    },
    [userId],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  useLiveRefresh(() => void load(true), { enabled: state === 'ready', intervalMs: 30000 });

  return { hub, state, reload: () => load(true) };
}
