import { useCallback, useEffect, useState } from 'react';
import type { GradeComponent, GradeComponentInput } from '../types/models';
import {
  addGradeEntry,
  createGradeComponent,
  deleteGradeComponent,
  getGradeComponents,
  removeGradeEntry,
  updateGradeComponent,
  updateGradeEntry,
  type GradeEntryInput,
} from '../api/gradeComponentsService';
import { useI18n } from '../i18n/useI18n';

// Componentes de nota de UMA cadeira num periodo concreto. As funcoes de
// escrita lancam o erro (o painel mostra a mensagem do servidor) e, quando
// correm bem, substituem o componente pela versao devolvida (ja com a nota
// agregada recalculada).
export function useGradeComponents(areaId: string, periodId: string | null) {
  const { t } = useI18n();
  const [components, setComponents] = useState<GradeComponent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!periodId) {
      setComponents([]);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError('');
    getGradeComponents({ areaId, periodId })
      .then((data) => {
        if (!cancelled) setComponents(data);
      })
      .catch(() => {
        if (!cancelled) setError(t('grades.loadError'));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t muda com o idioma, nao deve refazer o pedido
  }, [areaId, periodId]);

  const replace = useCallback((next: GradeComponent) => {
    setComponents((prev) => prev.map((c) => (c.id === next.id ? next : c)));
  }, []);

  const create = useCallback(
    async (input: GradeComponentInput) => {
      if (!periodId) return;
      const created = await createGradeComponent({ ...input, areaId, periodId });
      setComponents((prev) => [...prev, created]);
    },
    [areaId, periodId],
  );

  const update = useCallback(
    async (id: string, changes: Partial<GradeComponentInput>) => {
      replace(await updateGradeComponent(id, changes));
    },
    [replace],
  );

  const remove = useCallback(async (id: string) => {
    await deleteGradeComponent(id);
    setComponents((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const addEntry = useCallback(
    async (componentId: string, input: GradeEntryInput) => {
      replace(await addGradeEntry(componentId, input));
    },
    [replace],
  );

  const editEntry = useCallback(
    async (componentId: string, entryId: string, changes: Partial<GradeEntryInput>) => {
      replace(await updateGradeEntry(componentId, entryId, changes));
    },
    [replace],
  );

  const removeEntry = useCallback(
    async (componentId: string, entryId: string) => {
      replace(await removeGradeEntry(componentId, entryId));
    },
    [replace],
  );

  return { components, isLoading, error, create, update, remove, addEntry, editEntry, removeEntry };
}
