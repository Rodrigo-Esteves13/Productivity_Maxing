// Logica sem React dos cartoes que se atualizam sozinhos (ver
// hooks/useLivePolled).

export interface PolledLoadSink<T> {
  setData: (data: T) => void;
  setIsLoading: (isLoading: boolean) => void;
  setHasError: (hasError: boolean) => void;
}

/**
 * Uma leitura. `silent` (refresco em segundo plano) nao mostra "a carregar" e
 * uma falha mantem o que ja estava no ecra. Nunca lanca.
 */
export async function runPolledLoad<T>(
  fetcher: () => Promise<T>,
  silent: boolean,
  { setData, setIsLoading, setHasError }: PolledLoadSink<T>,
): Promise<void> {
  if (!silent) setIsLoading(true);
  try {
    setData(await fetcher());
    setHasError(false);
  } catch {
    if (!silent) setHasError(true);
  } finally {
    if (!silent) setIsLoading(false);
  }
}

/**
 * Uma escrita: se correr bem avisa os outros cartoes e volta a ler; se falhar
 * chama `onError`. Devolve se a escrita correu bem.
 */
export async function runPolledAction(
  action: () => Promise<unknown>,
  { onChanged, reload, onError }: { onChanged: () => void; reload: () => Promise<void>; onError: () => void },
): Promise<boolean> {
  try {
    await action();
    onChanged();
    await reload();
    return true;
  } catch {
    onError();
    return false;
  }
}
