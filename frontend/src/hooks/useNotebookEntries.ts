import { useCallback, useEffect, useState } from 'react';
import type { CreateNotebookEntryPayload, UpdateNotebookEntryPayload } from '../api/notebookService';
import {
  createNotebookEntry,
  deleteNotebookEntry,
  getNotebookEntries,
  updateNotebookEntry,
} from '../api/notebookService';
import type { NotebookEntry } from '../types/models';

export interface UseNotebookEntriesResult {
  entries: NotebookEntry[];
  isLoading: boolean;
  error: string;
  selectedEntry: NotebookEntry | null;
  selectEntry: (entry: NotebookEntry | null) => void;
  createEntry: (payload: CreateNotebookEntryPayload) => Promise<NotebookEntry>;
  updateEntry: (id: string, payload: UpdateNotebookEntryPayload) => Promise<void>;
  removeEntry: (id: string) => Promise<void>;
}

// Uma entrada por cadeira - carrega sempre que areaId muda, mesmo padrão de
// data-fetching por seleção que useTasksPage usa para o período ativo.
export function useNotebookEntries(areaId: string | null): UseNotebookEntriesResult {
  const [entries, setEntries] = useState<NotebookEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<NotebookEntry | null>(null);

  useEffect(() => {
    if (!areaId) {
      setEntries([]);
      setSelectedEntry(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError('');

    getNotebookEntries(areaId)
      .then((data) => {
        if (cancelled) return;
        setEntries(data);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Could not load this notebook. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [areaId]);

  const createEntry = useCallback(async (payload: CreateNotebookEntryPayload) => {
    const created = await createNotebookEntry(payload);
    setEntries((prev) => [created, ...prev]);
    setSelectedEntry(created);
    return created;
  }, []);

  const updateEntry = useCallback(
    async (id: string, payload: UpdateNotebookEntryPayload) => {
      const updated = await updateNotebookEntry(id, payload);
      setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      setSelectedEntry((prev) => (prev?.id === updated.id ? updated : prev));
    },
    [],
  );

  const removeEntry = useCallback(async (id: string) => {
    await deleteNotebookEntry(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setSelectedEntry((prev) => (prev?.id === id ? null : prev));
  }, []);

  return {
    entries,
    isLoading,
    error,
    selectedEntry,
    selectEntry: setSelectedEntry,
    createEntry,
    updateEntry,
    removeEntry,
  };
}
