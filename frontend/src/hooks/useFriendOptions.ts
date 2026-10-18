import { useEffect, useState } from 'react';
import { getSocialOverview, type FriendEntry } from '../api/socialService';

/** Lista de amigos aceites (so quando `enabled`), para escolher a quem convidar. */
export function useFriendOptions(enabled: boolean): { friends: FriendEntry[]; isLoading: boolean } {
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setIsLoading(true);
    getSocialOverview()
      .then((overview) => {
        if (!cancelled) setFriends(overview.friends);
      })
      .catch(() => {
        if (!cancelled) setFriends([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { friends, isLoading };
}
