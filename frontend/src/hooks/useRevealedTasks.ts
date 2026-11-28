import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { useIncrementalReveal } from './useIncrementalReveal';
import { minVisibleForIndex } from '../lib/incrementalReveal';

// Tasks desenhadas de cada vez na tabela, no quadro, na grelha e na timeline.
export const TASKS_PAGE_SIZE = 50;

// Ao imprimir, a lista tem de sair inteira. flushSync: o browser tira a
// "fotografia" logo a seguir ao beforeprint.
function useIsPrinting(): boolean {
  const [isPrinting, setIsPrinting] = useState(false);
  useEffect(() => {
    const start = () => flushSync(() => setIsPrinting(true));
    const end = () => setIsPrinting(false);
    window.addEventListener('beforeprint', start);
    window.addEventListener('afterprint', end);
    return () => {
      window.removeEventListener('beforeprint', start);
      window.removeEventListener('afterprint', end);
    };
  }, []);
  return isPrinting;
}

// Desenha uma lista grande aos bocados. So afeta o que aparece: selecao,
// arrastar, atalhos, pesquisa e exportacao continuam sobre a lista completa.
// `resetKey` (periodo, filtros, ordem) volta ao primeiro bloco; editar uma
// task nao. `keepIndex` e uma linha que tem de continuar visivel.
export function useRevealedTasks<T>(items: T[], resetKey?: string, keepIndex = -1) {
  const { visibleCount, hasMore, showMore } = useIncrementalReveal(
    items.length,
    TASKS_PAGE_SIZE,
    resetKey,
    minVisibleForIndex(keepIndex, TASKS_PAGE_SIZE),
  );
  const isPrinting = useIsPrinting();
  const isCut = hasMore && !isPrinting;

  return {
    visible: isCut ? items.slice(0, visibleCount) : items,
    remaining: isCut ? items.length - visibleCount : 0,
    showMore,
  };
}
