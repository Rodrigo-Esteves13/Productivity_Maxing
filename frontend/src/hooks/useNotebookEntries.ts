import { useCallback, useEffect, useRef, useState } from 'react';
import type { CreateNotebookEntryPayload, UpdateNotebookEntryPayload } from '../api/notebookService';
import {
  createNotebookEntry,
  deleteNotebookEntry,
  getNotebookEntry,
  getNotebookEntryMediaIds,
  getNotebookEntrySummaries,
  updateNotebookEntry,
} from '../api/notebookService';
import type { NotebookEntry, NotebookEntrySummary } from '../types/models';
import { translateNow } from '../i18n/translate';
import { toEntrySummary } from '../lib/notebookOverview';
import { EntryConflictError, parseEntryConflict } from '../lib/notebookEntryConflict';

function byDateDesc(a: { date: string }, b: { date: string }): number {
  return new Date(b.date).getTime() - new Date(a.date).getTime();
}

// Entradas completas ja abertas ficam em memoria: voltar a uma (anterior/
// seguinte) e imediato. Expira bem antes dos signed URLs das fotos (1 h).
const ENTRY_CACHE_MS = 10 * 60 * 1000;

// Os signed URLs das fotos/anexos duram 1 h (SIGNED_URL_TTL_SECONDS no
// backend). Numa entrada aberta muito tempo (uma aula de 90 min) renovam-se
// antes disso, ao voltar ao separador ou numa verificacao periodica.
const SIGNED_URL_REFRESH_MS = 50 * 60 * 1000;
const SIGNED_URL_CHECK_MS = 60 * 1000;

// Uma foto ou anexo carregado noutro dispositivo (ou noutra tab) aparece
// sozinho na entrada aberta: pergunta-se so pelos ids de tempos a tempos.
const MEDIA_SYNC_MS = 15 * 1000;

const sameIds = (a: string[], b: string[]) => a.length === b.length && a.every((id, i) => id === b[i]);

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
  // Troca a entrada aberta pela versao do servidor (conflito, proposta aprovada).
  replaceEntry: (entry: NotebookEntry) => void;
  // Muda a versao MAIS RECENTE da entrada em memoria (fotos/anexos). Nunca
  // parte de uma copia antiga apanhada num closure.
  patchEntry: (id: string, update: (latest: NotebookEntry) => NotebookEntry) => void;
  // Volta a pedir a entrada ao servidor e troca-a (cache incluida).
  reloadEntry: (id: string) => Promise<NotebookEntry | null>;
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
  // Quando os signed URLs de cada entrada foram gerados pelo servidor.
  const signedAtRef = useRef(new Map<string, number>());

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

  // fromServer = a entrada acabou de vir do backend (URLs acabados de assinar).
  const remember = useCallback((entry: NotebookEntry, fromServer = true) => {
    cacheRef.current.set(entry.id, { entry, at: Date.now() });
    if (fromServer) signedAtRef.current.set(entry.id, Date.now());
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

  const applyEntry = useCallback(
    (entry: NotebookEntry, fromServer: boolean) => {
      remember(entry, fromServer);
      setLoadedEntry((prev) => (prev?.id === entry.id ? entry : prev));
      // A lista mostra quantas fotos/ficheiros ha: tem de acompanhar.
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? toEntrySummary(entry) : e)));
    },
    [remember],
  );

  const replaceEntry = useCallback((entry: NotebookEntry) => applyEntry(entry, true), [applyEntry]);

  // A cache tem sempre a versao mais recente (cada gravacao faz remember):
  // um upload lento ja nao repoe o texto de antes do ultimo auto save, e dois
  // uploads seguidos ficam os dois.
  const patchEntry = useCallback(
    (id: string, update: (latest: NotebookEntry) => NotebookEntry) => {
      const latest = cacheRef.current.get(id)?.entry;
      if (latest) applyEntry(update(latest), false);
    },
    [applyEntry],
  );

  const reloadEntry = useCallback(
    async (id: string): Promise<NotebookEntry | null> => {
      try {
        const fresh = await getNotebookEntry(id);
        replaceEntry(fresh);
        return fresh;
      } catch {
        return null;
      }
    },
    [replaceEntry],
  );

  // Renova so os URLs das fotos/anexos (nao o texto nem a versao: trocar a
  // versao sem o conteudo deixava a proxima gravacao apagar o que mudou).
  const refreshSignedUrls = useCallback(
    (id: string) => {
      signedAtRef.current.set(id, Date.now());
      getNotebookEntry(id)
        .then((fresh) => {
          signedAtRef.current.set(id, Date.now());
          patchEntry(id, (latest) => ({ ...latest, photos: fresh.photos, attachments: fresh.attachments }));
        })
        .catch(() => signedAtRef.current.delete(id));
    },
    [patchEntry],
  );

  useEffect(() => {
    if (!selectedId) return undefined;
    const check = () => {
      if (document.visibilityState !== 'visible') return;
      const signedAt = signedAtRef.current.get(selectedId);
      if (signedAt !== undefined && Date.now() - signedAt > SIGNED_URL_REFRESH_MS) refreshSignedUrls(selectedId);
    };
    const interval = window.setInterval(check, SIGNED_URL_CHECK_MS);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', check);
    };
  }, [selectedId, refreshSignedUrls]);

  useEffect(() => {
    if (!selectedId) return undefined;
    const sync = () => {
      if (document.visibilityState !== 'visible') return;
      getNotebookEntryMediaIds(selectedId)
        .then(({ photoIds, attachmentIds }) => {
          const latest = cacheRef.current.get(selectedId)?.entry;
          if (!latest) return;
          const changed =
            !sameIds(photoIds, latest.photos.map((p) => p.id)) ||
            !sameIds(attachmentIds, latest.attachments.map((a) => a.id));
          if (changed) refreshSignedUrls(selectedId);
        })
        // Sem rede: tenta outra vez no proximo intervalo.
        .catch(() => undefined);
    };
    const interval = window.setInterval(sync, MEDIA_SYNC_MS);
    document.addEventListener('visibilitychange', sync);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [selectedId, refreshSignedUrls]);

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
      // Grava sobre a versao que este ecra conhece; se outra pessoa gravou
      // entretanto, o backend recusa (409) em vez de apagar a alteracao dela.
      const baseUpdatedAt = cacheRef.current.get(id)?.entry.updatedAt;
      let updated: NotebookEntry;
      try {
        updated = await updateNotebookEntry(id, baseUpdatedAt ? { ...payload, baseUpdatedAt } : payload);
      } catch (err) {
        const current = parseEntryConflict(err);
        throw current ? new EntryConflictError(current) : err;
      }
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
    patchEntry,
    reloadEntry,
    createEntry,
    updateEntry,
    removeEntry,
  };
}
