import { useCallback, useEffect, useState } from 'react';
import { getSharedWithMe, type SharedWithMeItem } from '../api/notebookService';
import { useLiveRefresh } from './useLiveRefresh';

export interface UseSharedWithMeResult {
  items: SharedWithMeItem[];
  isLoading: boolean;
  hasError: boolean;
}

export function useSharedWithMe(): UseSharedWithMeResult {
  const [items, setItems] = useState<SharedWithMeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const load = useCallback(async (silent: boolean) => {
    if (!silent) setIsLoading(true);
    try {
      setItems(await getSharedWithMe());
      setHasError(false);
    } catch {
      if (!silent) setHasError(true);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  // Um pedido pendente passa a aprovado sem F5 (push + polling).
  useLiveRefresh(() => void load(true), { enabled: true, intervalMs: 15000 });

  return { items, isLoading, hasError };
}
