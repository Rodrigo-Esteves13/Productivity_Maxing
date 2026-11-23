import { useCallback, useEffect, useState } from 'react';
import {
  createTaskPack,
  deleteTaskPack,
  listTaskPacks,
  publishTaskPack,
  renameTaskPack,
  type PackSyncResult,
  type TaskPackSummary,
} from '../api/taskPackService';
import { getUserAreas, getUserTasks } from '../api/userService';
import type { Area, Task } from '../types/models';
import { useFeedback } from '../context/useFeedback';
import { translateNow } from '../i18n/translate';
import { getApiMessage } from '../lib/httpError';

export function useTaskPacks() {
  const { notify } = useFeedback();
  const [packs, setPacks] = useState<TaskPackSummary[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const [packList, taskList, areaList] = await Promise.all([
        listTaskPacks(),
        getUserTasks(),
        getUserAreas(undefined, true),
      ]);
      setPacks(packList);
      setTasks(taskList);
      setAreas(areaList);
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // null = criado; texto = mensagem de erro (da API quando ha) para o modal.
  const create = useCallback(async (name: string, taskIds: string[]): Promise<string | null> => {
    setIsSaving(true);
    try {
      const pack = await createTaskPack(name, taskIds);
      setPacks((prev) => [pack, ...prev]);
      notify(translateNow('quickWins.packCreated', { name: pack.name }), 'success');
      return null;
    } catch (err) {
      return getApiMessage(err, translateNow('packs.create.error'));
    } finally {
      setIsSaving(false);
    }
  }, [notify]);

  const remove = useCallback(async (id: string): Promise<boolean> => {
    try {
      await deleteTaskPack(id);
      setPacks((prev) => prev.filter((p) => p.id !== id));
      notify(translateNow('quickWins.packDeleted'), 'success');
      return true;
    } catch (err) {
      notify(getApiMessage(err, translateNow('quickWins.packDeleteError')), 'error');
      return false;
    }
  }, [notify]);

  // Muda so o nome: o link partilhado nao muda.
  const rename = useCallback(async (id: string, name: string): Promise<boolean> => {
    try {
      const updated = await renameTaskPack(id, name);
      setPacks((prev) => prev.map((p) => (p.id === id ? { ...p, name: updated.name } : p)));
      notify(translateNow('ux4packs.rename.done', { name: updated.name }), 'success');
      return true;
    } catch (err) {
      notify(getApiMessage(err, translateNow('ux4packs.rename.error')), 'error');
      return false;
    }
  }, [notify]);

  // null = falhou (o componente mostra o erro).
  const publish = useCallback(async (id: string): Promise<PackSyncResult | null> => {
    try {
      return await publishTaskPack(id);
    } catch {
      return null;
    }
  }, []);

  return { packs, tasks, areas, isLoading, hasError, isSaving, create, remove, rename, publish };
}
