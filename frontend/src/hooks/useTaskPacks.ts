import { useCallback, useEffect, useState } from 'react';
import {
  createTaskPack,
  deleteTaskPack,
  listTaskPacks,
  type TaskPackSummary,
} from '../api/taskPackService';
import { getUserAreas, getUserTasks } from '../api/userService';
import type { Area, Task } from '../types/models';

export function useTaskPacks() {
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

  const create = useCallback(async (name: string, taskIds: string[]): Promise<boolean> => {
    setIsSaving(true);
    try {
      const pack = await createTaskPack(name, taskIds);
      setPacks((prev) => [pack, ...prev]);
      return true;
    } catch {
      return false;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const remove = useCallback(async (id: string): Promise<boolean> => {
    try {
      await deleteTaskPack(id);
      setPacks((prev) => prev.filter((p) => p.id !== id));
      return true;
    } catch {
      return false;
    }
  }, []);

  return { packs, tasks, areas, isLoading, hasError, isSaving, create, remove };
}
