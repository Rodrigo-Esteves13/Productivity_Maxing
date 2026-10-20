import { useCallback, useEffect, useRef, useState } from 'react';
import type { CreateNotebookEntryPayload, UpdateNotebookEntryPayload } from '../api/notebookService';
import {
  createNotebookEntry,
  deleteNotebookEntry,
  getNotebookEntry,
  getNotebookEntrySummaries,
  updateNotebookEntry,
} from '../api/notebookService';
import type { NotebookEntry, NotebookEntrySummary } from '../types/models';
import { translateNow } from '../i18n/translate';
import { toEntrySummary } from '../lib/notebookOverview';

function byDateDesc(a: { date: string }, b: { date: string }): number {
  return new Date(b.date).getTime() - new Date(a.date).getTime();
}

// Entradas completas ja abertas ficam em memoria: voltar a uma (anterior/
// seguinte) e imediato. Expira bem antes dos signed URLs das fotos (1 h).
const ENTRY_CACHE_MS = 10 * 60 * 1000;

// Resultados de pesquisa e links trazem a entrada completa; a lista so o resumo.
function isFullEntry(entry: NotebookEntry | NotebookEntrySummary): entry is NotebookEntry {
  return 'photos' in entry;
}

export interface UseNotebookEntriesResult {
  entries: NotebookEntrySummary[];
  isLoading: boolean;
  error: string;
  selectedId: string | null;
  // A entrada aberta, completa. null enquanto carrega ou sem nenhuma aberta.
  selectedEntry: NotebookEntry | null;
  isLoadingEntry: boolean;
  entryError: string;
  selectEntry: (entry: NotebookEntry | NotebookEntrySummary | null) => void;
  // Pede a entrada antes do clique (passar o rato/foco na lista).
  prefetchEntry: (id: string) => void;
  retryEntry: () => void;
  // Troca a entrada aberta por uma versao nova (ex.: depois de juntar uma foto).
  replaceEntry: (entry: NotebookEntry) => void;
  createEntry: (payload: CreateNotebookEntryPayload) => Promise<NotebookEntry>;
  updateEntry: (id: string, payload: UpdateNotebookEntryPayload) => Promise<void>;
  removeEntry: (id: string) => Promise<void>;
}

// A lista de uma cadeira carrega sempre que areaId muda (so o resumo de cada
// entrada); a entrada completa so vem quando e aberta.
export function useNotebookEntries(areaId: string | null): UseNotebookEntriesResult {
  const [entries, setEntries] = useState<NotebookEntrySummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadedEntry, setLoadedEntry] = useState<NotebookEntry | null>(null);
  const [entryError, setEntryError] = useState('');
  const selectedIdRef = useRef<string | null>(null);
  const cacheRef = useRef(new Map<string, { entry: NotebookEntry; at: number }>());
  const pendingRef = useRef(new Map<string, Promise<NotebookEntry>>());

  useEffect(() => {
    if (!areaId) {
      setEntries([]);
      selectedIdRef.current = null;
      setSelectedId(null);
      setLoadedEntry(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError('');

    getNotebookEntrySummaries(areaId)
      .then((data) => {
        if (cancelled) return;
        setEntries(data);
      })
      .catch(() => {
        if (cancelled) return;
        setError(translateNow('hook.couldNotLoadThisNotebookPlease'));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [areaId]);

  const remember = useCallback((entry: NotebookEntry) => {
    cacheRef.current.set(entry.id, { entry, at: Date.now() });
  }, []);

  const cachedEntry = useCallback((id: string): NotebookEntry | null => {
    const hit = cacheRef.current.get(id);
    return hit && Date.now() - hit.at < ENTRY_CACHE_MS ? hit.entry : null;
  }, []);

  // Um so pedido por entrada, mesmo com prefetch e clique ao mesmo tempo.
  const fetchEntry = useCallback(
    (id: string): Promise<NotebookEntry> => {
      const hit = cachedEntry(id);
      if (hit) return Promise.resolve(hit);
      let pending = pendingRef.current.get(id);
      if (!pending) {
        pending = getNotebookEntry(id)
          .then((entry) => {
            remember(entry);
            return entry;
          })
          .finally(() => pendingRef.current.delete(id));
        pendingRef.current.set(id, pending);
      }
      return pending;
    },
    [cachedEntry, remember],
  );

  const openById = useCallback(
    (id: string) => {
      setEntryError('');
      // Ja em memoria: aparece logo, sem passar pelo esqueleto.
      const hit = cachedEntry(id);
      if (hit) {
        setLoadedEntry(hit);
        return;
      }
      setLoadedEntry(null);
      fetchEntry(id)
        .then((entry) => {
          if (selectedIdRef.current === id) setLoadedEntry(entry);
        })
        .catch(() => {
          if (selectedIdRef.current === id) setEntryError(translateNow('notebook.entry.loadError'));
        });
    },
    [cachedEntry, fetchEntry],
  );

  const selectEntry = useCallback(
    (entry: NotebookEntry | NotebookEntrySummary | null) => {
      const id = entry?.id ?? null;
      selectedIdRef.current = id;
      setSelectedId(id);
      setEntryError('');
      if (!entry) {
        setLoadedEntry(null);
      } else if (isFullEntry(entry)) {
        remember(entry);
        setLoadedEntry(entry);
      } else {
        openById(entry.id);
      }
    },
    [openById, remember],
  );

  const prefetchEntry = useCallback(
    (id: string) => {
      void fetchEntry(id).catch(() => undefined);
    },
    [fetchEntry],
  );

  const retryEntry = useCallback(() => {
    if (selectedIdRef.current) openById(selectedIdRef.current);
  }, [openById]);

  const replaceEntry = useCallback(
    (entry: NotebookEntry) => {
      remember(entry);
      setLoadedEntry((prev) => (prev?.id === entry.id ? entry : prev));
      // A lista mostra quantas fotos/ficheiros ha: tem de acompanhar.
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? toEntrySummary(entry) : e)));
    },
    [remember],
  );

  const createEntry = useCallback(
    async (payload: CreateNotebookEntryPayload) => {
      const created = await createNotebookEntry(payload);
      setEntries((prev) => [toEntrySummary(created), ...prev].sort(byDateDesc));
      selectEntry(created);
      return created;
    },
    [selectEntry],
  );

  const updateEntry = useCallback(
    async (id: string, payload: UpdateNotebookEntryPayload) => {
      const updated = await updateNotebookEntry(id, payload);
      remember(updated);
      setEntries((prev) =>
        prev.map((e) => (e.id === updated.id ? toEntrySummary(updated) : e)).sort(byDateDesc),
      );
      setLoadedEntry((prev) => (prev?.id === updated.id ? updated : prev));
    },
    [remember],
  );

  const removeEntry = useCallback(async (id: string) => {
    await deleteNotebookEntry(id);
    cacheRef.current.delete(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
    if (selectedIdRef.current === id) {
      selectedIdRef.current = null;
      setSelectedId(null);
      setLoadedEntry(null);
    }
  }, []);

  // So a entrada da selecao atual (nunca a anterior enquanto a nova carrega).
  const selectedEntry = loadedEntry && loadedEntry.id === selectedId ? loadedEntry : null;

  return {
    entries,
    isLoading,
    error,
    selectedId,
    selectedEntry,
    isLoadingEntry: selectedId !== null && selectedEntry === null && !entryError,
    entryError,
    selectEntry,
    prefetchEntry,
    retryEntry,
    replaceEntry,
    createEntry,
    updateEntry,
    removeEntry,
  };
}
