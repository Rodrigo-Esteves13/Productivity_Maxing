import { useCallback } from 'react';
import { useFetch, type Fetcher } from './useFetch';

// Como o useLoadOnce, mas o fetcher recebe um AbortSignal: ao desmontar ou ao
// voltar a pedir, o pedido anterior e cancelado.
export function useLoadAbortable<T>(fetcher: Fetcher<T>, refreshKey?: string | null) {
  const { data, isLoading, hasError, reload } = useFetch(fetcher, { refreshKey });
  return { data, isLoading, error: hasError, reload };
}

// Vai buscar um recurso ao montar e devolve {data, isLoading, error, reload}.
// Apesar do nome, volta a pedir quando `fetcher` ou `refreshKey` mudam (ver a
// semantica completa em useFetch) e cada instancia faz o seu pedido.
// `fetcher` tem de ser uma funcao estavel (definida fora do componente ou
// useCallback). `reload` busca outra vez sem voltar ao estado de "a
// carregar", para o conteudo nao piscar; um erro mantem os dados anteriores.
// `refreshKey` (opcional): quando muda, busca outra vez (ex: o id da sessao de
// estudo ativa, para o streak atualizar quando uma sessao acaba).
// O fetcher e chamado sem argumentos: os servicos em api/ tem parametros
// opcionais que nao podem receber o sinal por engano.
export function useLoadOnce<T>(fetcher: () => Promise<T>, refreshKey?: string | null) {
  const withoutSignal = useCallback(() => fetcher(), [fetcher]);
  return useLoadAbortable(withoutSignal, refreshKey);
}
