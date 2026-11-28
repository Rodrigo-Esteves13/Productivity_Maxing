import { useCallback, useEffect, useState } from 'react';
import { useLiveRefresh } from './useLiveRefresh';
import * as bus from '../lib/bus';
import { runPolledAction, runPolledLoad } from '../lib/polledLoad';
import { useFeedback } from '../context/useFeedback';
import { translateNow } from '../i18n/translate';

interface LivePolledOptions<T> {
  /** Tem de ser uma funcao estavel (definida fora do componente). */
  fetcher: () => Promise<T>;
  /** Valor antes da primeira resposta (tambem estavel). */
  initial: T;
  intervalMs: number;
  enabled?: boolean;
}

// Base dos cartoes do Social (F-29): le ao montar, refresca em silencio (push,
// voltar ao separador, polling e acoes feitas noutro cartao) e trata as
// escritas.
export function useLivePolled<T>({ fetcher, initial, intervalMs, enabled = true }: LivePolledOptions<T>) {
  const [data, setData] = useState<T>(initial);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const { notify } = useFeedback();

  const load = useCallback(
    (silent = false) => runPolledLoad(fetcher, silent, { setData, setIsLoading, setHasError }),
    [fetcher],
  );

  useEffect(() => {
    if (enabled) void load();
  }, [enabled, load]);

  // Pedidos novos aparecem sem F5 (push, voltar ao separador, polling).
  useLiveRefresh(() => void load(true), { enabled, intervalMs });
  // Acao noutro cartao do Social (ex: aceitar um pedido de notas): le de novo
  // em silencio. O GET repetido pelo proprio emissor junta-se no dedupe.
  useEffect(() => {
    if (!enabled) return undefined;
    return bus.on('social:changed', () => void load(true));
  }, [enabled, load]);

  // F-54: a mesma mensagem para qualquer escrita falhada do Social.
  const notifyActionError = useCallback(() => notify(translateNow('social.actionError'), 'error'), [notify]);

  const run = useCallback(
    (action: () => Promise<unknown>): Promise<boolean> =>
      // Aceitar/recusar/remover/bloquear: o botao fica igual, por isso a
      // falha tem de se ver.
      runPolledAction(action, { onChanged: () => bus.emit('social:changed'), reload: () => load(true), onError: notifyActionError }),
    [load, notifyActionError],
  );

  return { data, setData, isLoading, hasError, load, run, notifyActionError };
}
