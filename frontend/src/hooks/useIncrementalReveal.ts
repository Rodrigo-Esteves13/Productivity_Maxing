import { useCallback, useState } from 'react';

interface UseIncrementalRevealReturn {
  visibleCount: number;
  hasMore: boolean;
  canCollapse: boolean;
  showMore: () => void;
  collapse: () => void;
}

interface RevealState {
  key: string | number | undefined;
  count: number;
}

// Mostra uma lista grande aos bocados ("Show more") em vez de a despejar
// toda no ecra. `resetKey` volta ao primeiro bloco quando muda (ex: o
// intervalo de dias escolhido). O reset e derivado em render (sem useEffect)
// para nao haver um render extra com a lista errada.
export function useIncrementalReveal(
  total: number,
  pageSize: number,
  resetKey?: string | number,
): UseIncrementalRevealReturn {
  const [state, setState] = useState<RevealState>({ key: resetKey, count: pageSize });
  const visibleCount = state.key === resetKey ? state.count : pageSize;

  const showMore = useCallback(
    () => setState({ key: resetKey, count: visibleCount + pageSize }),
    [resetKey, visibleCount, pageSize],
  );
  const collapse = useCallback(() => setState({ key: resetKey, count: pageSize }), [resetKey, pageSize]);

  return {
    visibleCount,
    hasMore: visibleCount < total,
    canCollapse: visibleCount > pageSize,
    showMore,
    collapse,
  };
}
