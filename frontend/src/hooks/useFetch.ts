import { useCallback, useEffect, useRef, useState } from 'react';
import { isRequestCanceled } from '../lib/abortable';

export type Fetcher<T> = (signal: AbortSignal) => Promise<T>;

export interface UseFetchOptions {
  // Quando muda, pede outra vez (ex: o id da sessao de estudo ativa).
  refreshKey?: string | number | null;
  // Limpa o erro anterior assim que um pedido novo arranca.
  clearErrorOnStart?: boolean;
  // Um pedido falhado apaga os dados em vez de manter os anteriores.
  clearDataOnError?: boolean;
  // Com fetcher null esquece o que tinha, em vez de o guardar.
  resetWhenDisabled?: boolean;
}

interface FetchState<T> {
  data: T | null;
  isLoading: boolean;
  hasError: boolean;
}

const INITIAL_STATE = { data: null, isLoading: true, hasError: false };

// Fetch comum (F-19, F-28):
// - pede ao montar e quando `fetcher`, `refreshKey` ou `reload()` mudam. Nao
//   e "uma vez so" nem partilha o resultado entre instancias.
// - `fetcher` tem de ser estavel (funcao de modulo ou useCallback); null
//   significa "nao ha nada a pedir".
// - so o primeiro pedido mostra isLoading; os seguintes sao silenciosos.
// - um pedido novo, ou desmontar, cancela o anterior (AbortSignal) e a
//   resposta dele e ignorada, mesmo que o fetcher nao use o sinal.
// - `reload()` e estavel e resolve quando o pedido acaba.
export function useFetch<T>(fetcher: Fetcher<T> | null, options: UseFetchOptions = {}) {
  const { refreshKey, clearErrorOnStart = false, clearDataOnError = false, resetWhenDisabled = false } = options;
  const [state, setState] = useState<FetchState<T>>(INITIAL_STATE);
  const controllerRef = useRef<AbortController | null>(null);
  // Fica null depois de desmontar, para um reload() tardio nao pedir nada.
  const runRef = useRef<(() => Promise<void>) | null>(null);

  const run = useCallback(async () => {
    controllerRef.current?.abort();
    if (!fetcher) {
      if (resetWhenDisabled) setState(INITIAL_STATE);
      return;
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    if (clearErrorOnStart) setState((prev) => (prev.hasError ? { ...prev, hasError: false } : prev));
    try {
      const data = await fetcher(controller.signal);
      if (!controller.signal.aborted) setState({ data, isLoading: false, hasError: false });
    } catch (error) {
      if (controller.signal.aborted || isRequestCanceled(error)) return;
      setState((prev) => ({ data: clearDataOnError ? null : prev.data, isLoading: false, hasError: true }));
    }
  }, [fetcher, clearErrorOnStart, clearDataOnError, resetWhenDisabled]);

  useEffect(() => {
    runRef.current = run;
    void run();
    return () => {
      runRef.current = null;
      controllerRef.current?.abort();
    };
  }, [run, refreshKey]);

  const reload = useCallback(() => runRef.current?.() ?? Promise.resolve(), []);

  return { ...state, reload };
}
