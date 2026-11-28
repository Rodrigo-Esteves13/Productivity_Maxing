import { useCallback, useEffect, useState } from 'react';
import {
  addTaskPackItems,
  listTaskPackItems,
  removeTaskPackItem,
  updateTaskPackItem,
  type TaskPackItem,
  type TaskPackItemEdit,
} from '../api/taskPackService';
import { useFeedback } from '../context/useFeedback';
import { translateNow } from '../i18n/translate';
import { getApiMessage } from '../lib/httpError';

/** Tarefas dentro de um pacote teu: ler, juntar, editar e tirar. */
export function useTaskPackItems(packId: string, onItemCount: (id: string, count: number) => void) {
  const { notify } = useFeedback();
  const [items, setItems] = useState<TaskPackItem[] | null>(null);
  const [hasError, setHasError] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listTaskPackItems(packId)
      .then((list) => !cancelled && setItems(list))
      .catch(() => !cancelled && setHasError(true));
    return () => {
      cancelled = true;
    };
  }, [packId]);

  // null = correu bem; texto = erro a mostrar.
  const run = useCallback(async (action: () => Promise<void>): Promise<string | null> => {
    setIsBusy(true);
    try {
      await action();
      return null;
    } catch (err) {
      return getApiMessage(err, translateNow('f7Study.packs.error'));
    } finally {
      setIsBusy(false);
    }
  }, []);

  const apply = useCallback(
    (list: TaskPackItem[]) => {
      setItems(list);
      onItemCount(packId, list.length);
    },
    [packId, onItemCount],
  );

  const add = useCallback(
    (taskIds: string[]) =>
      run(async () => {
        apply(await addTaskPackItems(packId, taskIds));
        notify(translateNow('f7Study.packs.added'), 'success');
      }),
    [run, apply, packId, notify],
  );

  const remove = useCallback(
    (itemId: string) =>
      run(async () => {
        apply(await removeTaskPackItem(packId, itemId));
        notify(translateNow('f7Study.packs.removed'), 'success');
      }),
    [run, apply, packId, notify],
  );

  const update = useCallback(
    (itemId: string, edit: TaskPackItemEdit) =>
      run(async () => {
        const result = await updateTaskPackItem(packId, itemId, edit);
        notify(translateNow('f7Study.packs.updated', { requests: result.proposalsCreated }), 'success');
        apply(await listTaskPackItems(packId));
      }),
    [run, apply, packId, notify],
  );

  return { items, hasError, isBusy, add, remove, update };
}
