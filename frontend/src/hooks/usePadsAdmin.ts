import { useCallback, useEffect, useState } from 'react';
import { ADMIN_PADS_PAGE_SIZE, getAdminPads, getBlockedPadSources } from '../api/padsService';
import { useDebouncedValue } from './useDebouncedValue';
import { useFetch } from './useFetch';

const SEARCH_DEBOUNCE_MS = 300;

// Se a pagina pedida ficou para la do fim (apagou-se o ultimo item), recua.
function useStepBack(
  data: { total: number; items: unknown[] } | null,
  skip: number,
  setSkip: (skip: number) => void,
) {
  useEffect(() => {
    if (data && data.items.length === 0 && data.total > 0 && skip >= data.total) {
      setSkip(Math.max(0, skip - ADMIN_PADS_PAGE_SIZE));
    }
  }, [data, skip, setSkip]);
}

// Listas de moderacao de pads: pesquisa e paginas no servidor.
export function usePadsAdmin() {
  const [query, setQuery] = useState('');
  const search = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);
  const [skip, setSkip] = useState(0);
  const [blockedSkip, setBlockedSkip] = useState(0);

  const fetchPads = useCallback(
    (signal: AbortSignal) =>
      getAdminPads({ skip, take: ADMIN_PADS_PAGE_SIZE, ...(search ? { q: search } : {}) }, signal),
    [skip, search],
  );
  const fetchBlocked = useCallback(
    (signal: AbortSignal) => getBlockedPadSources({ skip: blockedSkip, take: ADMIN_PADS_PAGE_SIZE }, signal),
    [blockedSkip],
  );
  const pads = useFetch(fetchPads);
  const blocked = useFetch(fetchBlocked);
  useStepBack(pads.data, skip, setSkip);
  useStepBack(blocked.data, blockedSkip, setBlockedSkip);

  const { reload: reloadPads } = pads;
  const { reload: reloadBlocked } = blocked;
  const reload = useCallback(() => {
    void reloadPads();
    void reloadBlocked();
  }, [reloadPads, reloadBlocked]);

  return {
    pads,
    blocked,
    query,
    // Pesquisar volta sempre a primeira pagina.
    setQuery: (value: string) => {
      setQuery(value);
      setSkip(0);
    },
    search,
    skip,
    setSkip,
    blockedSkip,
    setBlockedSkip,
    pageSize: ADMIN_PADS_PAGE_SIZE,
    reload,
  };
}
