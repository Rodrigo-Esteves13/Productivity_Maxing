import { useCallback, useEffect, useState } from 'react';

// Vai buscar um recurso ao montar e devolve {data, isLoading, error, reload}.
// Ignora a resposta se o componente ja desmontou. `fetcher` tem de ser uma
// funcao estavel (definida fora do componente). `reload` busca outra vez
// sem voltar ao estado de "a carregar", para o conteudo nao piscar.
export function useLoadOnce<T>(fetcher: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetcher()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetcher, reloadCount]);

  const reload = useCallback(() => setReloadCount((count) => count + 1), []);

  return { data, isLoading, error, reload };
}
