import { useEffect, useMemo, useRef, useState } from 'react';
import { getUserAreas } from '../../api/areasService';
import { getUserTasks } from '../../api/tasksService';
import { searchNotebook } from '../../api/notebookService';
import { searchTurmaNotes } from '../../api/turmasService';
import { loadRecents, removeRecent, type RecentEntry } from '../../lib/paletteRecents';
import type { Area, Task, NotebookSearchResult, TurmaNoteSearchResult } from '../../types/models';
import { indexTasks } from './buildPaletteItems';

// Ao contrário das tasks (pré-carregadas de uma vez e filtradas
// localmente), o notebook pode ter muitas entradas por Area - por isso
// vai a pedido ao endpoint GET /notebook/search já existente, com debounce
// para não martelar a API a cada tecla premida.
const NOTEBOOK_SEARCH_DEBOUNCE_MS = 250;

interface PaletteDataOptions {
  isOpen: boolean;
  query: string;
  userId: string | undefined;
  shortcutsEnabled: boolean;
}

// Dados do Ctrl+K: recentes, tasks e Areas (a pedido, no primeiro open) e a
// pesquisa ao caderno e as notas das turmas.
export function usePaletteData({ isOpen, query, userId, shortcutsEnabled }: PaletteDataOptions) {
  const [recents, setRecents] = useState<RecentEntry[]>([]);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  // Lista de tasks carregada com sucesso (uma falha deixa [] e nao prova que
  // uma task recente deixou de existir).
  const [tasksLoaded, setTasksLoaded] = useState(false);
  const [notebookResults, setNotebookResults] = useState<NotebookSearchResult[]>([]);
  const [turmaNoteResults, setTurmaNoteResults] = useState<TurmaNoteSearchResult[]>([]);
  // null = not fetched yet (lazy, same as tasks); [] = fetched, none exist.
  const [areas, setAreas] = useState<Area[] | null>(null);
  // Listas pedidas no primeiro open. Uma falha (ex: arranque a frio do
  // Render) ja nao fica como resposta final: volta a pedir no open seguinte.
  // E de quem sao: depois de logout + login com outra conta (SPA, sem
  // reload) as listas da conta anterior nao podem ser usadas (F-07).
  const tasksFailedRef = useRef(false);
  const areasFailedRef = useRef(false);
  const listsUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setRecents(shortcutsEnabled ? loadRecents(userId) : []);

    // Tasks are fetched lazily on first open rather than eagerly on every
    // page load - the palette is opt-in (Cmd/Ctrl+K), no reason to make
    // every page pay for a tasks fetch it might never need. Not
    // re-fetched on subsequent opens in the same session; the task list
    // rarely changes fast enough within one sitting to matter here, and
    // this avoids hammering the API every time someone hits Cmd+K.
    const currentUserId = userId ?? null;
    const otherUser = listsUserIdRef.current !== currentUserId;
    listsUserIdRef.current = currentUserId;
    if (otherUser) {
      setTasks(null);
      setTasksLoaded(false);
      setAreas(null);
    }

    if (tasks === null || otherUser || tasksFailedRef.current) {
      tasksFailedRef.current = false;
      getUserTasks()
        .then((list) => {
          setTasks(list);
          setTasksLoaded(true);
        })
        .catch(() => {
          tasksFailedRef.current = true;
          setTasks([]);
          setTasksLoaded(false);
        });
    }

    // Same lazy approach for Areas - only needed by quick-add, so it is
    // fetched on first open, not on every page load.
    if (areas === null || otherUser || areasFailedRef.current) {
      areasFailedRef.current = false;
      getUserAreas()
        .then(setAreas)
        .catch(() => {
          areasFailedRef.current = true;
          setAreas([]);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Pesquisa ao notebook (título, conteúdo, cadeira, data formatada - ver
  // NotebookService.search no backend) sempre que a query muda, com
  // debounce. Antes disto, Cmd+K só encontrava Tasks - o conteúdo do
  // caderno ficava invisível à pesquisa global.
  useEffect(() => {
    if (!isOpen) return;
    const q = query.trim();
    if (q === '') {
      setNotebookResults([]);
      setTurmaNoteResults([]);
      return;
    }

    let cancelled = false;
    const id = window.setTimeout(() => {
      searchNotebook(q)
        .then((results) => {
          if (!cancelled) setNotebookResults(results);
        })
        .catch(() => {
          if (!cancelled) setNotebookResults([]);
        });
      // Notas das turmas: mesma pesquisa, mesmo debounce.
      searchTurmaNotes(q)
        .then((results) => {
          if (!cancelled) setTurmaNoteResults(results);
        })
        .catch(() => {
          if (!cancelled) setTurmaNoteResults([]);
        });
    }, NOTEBOOK_SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [isOpen, query]);

  // Calculado uma vez por carga, nao a cada tecla.
  const taskIndex = useMemo(() => indexTasks(tasks ?? []), [tasks]);

  // Recentes de tasks que ja nao existem saem do armazenamento (so grava).
  useEffect(() => {
    if (!tasksLoaded || !userId) return;
    const ids = new Set(taskIndex.map((entry) => entry.task.id));
    for (const recent of loadRecents(userId)) {
      if (recent.kind === 'task' && !ids.has(recent.id)) removeRecent(userId, 'task', recent.id);
    }
  }, [tasksLoaded, taskIndex, userId]);

  return {
    recents,
    setRecents,
    setTasks,
    tasksLoaded,
    taskIndex,
    notebookResults,
    turmaNoteResults,
    areas,
  };
}
