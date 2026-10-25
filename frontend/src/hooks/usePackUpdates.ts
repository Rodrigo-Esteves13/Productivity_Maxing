import { useCallback, useEffect, useState } from 'react';
import {
  acceptPackUpdate,
  listPackUpdates,
  rejectPackUpdate,
  type PackUpdate,
} from '../api/taskPackService';
import { getApiMessage } from '../lib/httpError';
import { translateNow } from '../i18n/translate';

// Pedidos de atualizacao de pacotes importados (o dono mudou uma data, um
// peso...). Nada muda na task sem aceitar. Devolve a mensagem de erro do
// backend quando aceitar falha (ex: o peso novo passa os 100% da cadeira).
export function usePackUpdates() {
  const [updates, setUpdates] = useState<PackUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      setUpdates(await listPackUpdates());
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = useCallback(
    async (id: string, action: (id: string) => Promise<void>): Promise<string | null> => {
      setBusyId(id);
      try {
        await action(id);
        setUpdates((prev) => prev.filter((u) => u.id !== id));
        return null;
      } catch (error) {
        return getApiMessage(error, translateNow('packs.updates.error'));
      } finally {
        setBusyId(null);
      }
    },
    [],
  );

  const accept = useCallback((id: string) => decide(id, acceptPackUpdate), [decide]);
  const reject = useCallback((id: string) => decide(id, rejectPackUpdate), [decide]);

  return { updates, isLoading, hasError, busyId, accept, reject, reload: load };
}
