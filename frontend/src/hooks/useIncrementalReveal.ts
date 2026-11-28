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
  // Linhas que tem de estar visiveis (ex: ate a linha escolhida). O que ja
  // foi revelado por isto mantem-se quando o minimo volta a descer.
  minVisible = 0,
): UseIncrementalRevealReturn {
  const [state, setState] = useState<RevealState>({ key: resetKey, count: pageSize });
  const storedCount = state.key === resetKey ? state.count : pageSize;
  const visibleCount = Math.max(storedCount, minVisible);
  if (visibleCount > storedCount) setState({ key: resetKey, count: visibleCount });

  const showMore = useCallback(
    () => setState({ key: resetKey, count: visibleCount + pageSize }),
    [resetKey, visibleCount, pageSize],
  );
  const collapse = useCallback(() => setState({ key: resetKey, count: pageSize }), [resetKey, pageSize]);

  return {
    visibleCount,
    hasMore: visibleCount < total,
    canCollapse: visibleCount > Math.max(pageSize, minVisible),
    showMore,
    collapse,
  };
}
