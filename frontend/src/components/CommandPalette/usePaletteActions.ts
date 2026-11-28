import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import { useNavigate } from 'react-router-dom';
import { createTask } from '../../api/tasksService';
import { getTaskMetadata } from '../../api/metadataService';
import { getNotebookEntry } from '../../api/notebookService';
import { getTurmaNote } from '../../api/turmasService';
import { notebookEntryPath, turmaNotePath } from '../../lib/appLinks';
import type { QuickAddPriority } from '../../lib/parseQuickAddTask';
import { setLastUsedAreaId } from '../../lib/lastUsedArea';
import { isGoneError, recordRecent, removeRecent, type RecentEntry } from '../../lib/paletteRecents';
import { OPEN_SHORTCUTS_HELP_EVENT } from '../../lib/shortcutSequence';
import type { PaletteTaskActionId } from '../../lib/paletteActions';
import type { Task } from '../../types/models';
import { useI18n } from '../../i18n/useI18n';
import { useCompleteWithUndo } from '../../hooks/useCompleteWithUndo';
import { useQuickReschedule } from '../../hooks/useQuickReschedule';
import { useActiveStudySession } from '../../context/useActiveStudySession';
import { useFeedback } from '../../context/useFeedback';
import {
  QUICK_ADD_DIFFICULTY,
  QUICK_ADD_TASK_TYPE,
  type IndexedTask,
  type PaletteItem,
  type QuickAddItem,
} from './buildPaletteItems';
import { SHORTCUTS_COMMAND_ID } from './navCommands';

// Palavras que identificam cada nivel no catalogo de prioridades.
const PRIORITY_MATCH: Record<QuickAddPriority, string[]> = {
  HIGH: ['high', 'alta', 'urgent'],
  MEDIUM: ['medium', 'media', 'média'],
  LOW: ['low', 'baixa'],
};

interface PaletteActionsOptions {
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  userId: string | undefined;
  shortcutsEnabled: boolean;
  taskIndex: IndexedTask[];
  tasksLoaded: boolean;
  setTasks: Dispatch<SetStateAction<Task[] | null>>;
  setRecents: Dispatch<SetStateAction<RecentEntry[]>>;
}

// O que acontece ao escolher uma linha do Ctrl+K: navegar, criar a task do
// quick-add e as acoes rapidas sobre uma task.
export function usePaletteActions({
  setIsOpen,
  userId,
  shortcutsEnabled,
  taskIndex,
  tasksLoaded,
  setTasks,
  setRecents,
}: PaletteActionsOptions) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { notify } = useFeedback();
  const { activeSession, start: startStudySession } = useActiveStudySession();
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Acoes rapidas sobre a task destacada. Reutilizam os mesmos hooks do
  // Dashboard (feita com Undo, adiar para amanha), por isso o postponedCount
  // e o calendario seguem as mesmas regras; a lista local mantem-se em dia.
  const setTaskList = useCallback<Dispatch<SetStateAction<Task[]>>>(
    (action) => {
      setTasks((prev) => {
        const base = prev ?? [];
        return typeof action === 'function' ? action(base) : action;
      });
    },
    [setTasks],
  );
  const { completeOne } = useCompleteWithUndo(setTaskList);
  const onPostponed = useCallback(
    (updated: Task) => {
      setTasks((prev) => (prev ? prev.map((task) => (task.id === updated.id ? { ...task, ...updated } : task)) : prev));
      notify(t('paletteActions.postponed'), 'success');
    },
    [notify, t, setTasks],
  );
  const { rescheduleToTomorrow } = useQuickReschedule(onPostponed);

  const createQuickTask = async (item: QuickAddItem) => {
    if (isCreating || !item.area) return;
    setIsCreating(true);
    setCreateError('');
    try {
      // Prioridade escrita -> key real do catalogo (o admin pode ter
      // renomeado as keys; compara-se com key ou label). Falhar aqui nunca
      // impede criar a task: so fica sem prioridade.
      let priorityKey: string | undefined;
      if (item.priority) {
        try {
          const meta = await getTaskMetadata();
          priorityKey = (meta.priorities ?? []).find((p) => {
            const hints = PRIORITY_MATCH[item.priority as QuickAddPriority];
            return hints.some((h) => p.key.toLowerCase().includes(h) || p.label.toLowerCase().includes(h));
          })?.key;
        } catch {
          priorityKey = undefined;
        }
      }
      const created: unknown = await createTask({
        areaId: item.area.id,
        title: item.title,
        date: item.dateIso,
        type: QUICK_ADD_TASK_TYPE,
        difficulty: QUICK_ADD_DIFFICULTY,
        ...(priorityKey ? { priority: priorityKey } : {}),
      });
      setLastUsedAreaId(item.area.id);
      // Keep the lazily-loaded task list in sync so a following search in
      // the same session can find the task that was just created.
      if (typeof created === 'object' && created !== null && 'id' in created) {
        setTasks((prev) => (prev ? [...prev, created as Task] : prev));
        setIsOpen(false);
        navigate(`/tasks?open=${String((created as { id: unknown }).id)}`);
      } else {
        setIsOpen(false);
        navigate('/tasks');
      }
    } catch {
      // Palette stays open with the typed text intact, so nothing is lost.
      setCreateError(t('palette.error'));
    } finally {
      setIsCreating(false);
    }
  };

  // O item recente ja nao existe: sai da lista e do armazenamento, com aviso.
  const dropRecent = (recent: RecentEntry) => {
    removeRecent(userId, recent.kind, recent.id);
    setRecents((prev) => prev.filter((r) => !(r.kind === recent.kind && r.id === recent.id)));
    notify(t('paletteShortcuts.recentGone'), 'info');
  };

  // Notas (caderno/turma) so se sabe se ainda existem ao pedir ao servidor;
  // 404/403 = apagada ou sem acesso. Outra falha (rede) segue para a pagina,
  // que mostra o seu proprio erro.
  const openRemoteRecent = async (recent: RecentEntry, path: string) => {
    try {
      if (recent.kind === 'notebook') await getNotebookEntry(recent.id);
      else if (recent.parentId) await getTurmaNote(recent.parentId, recent.id);
    } catch (err) {
      if (isGoneError(err)) {
        dropRecent(recent);
        return;
      }
    }
    setIsOpen(false);
    recordRecent(userId, recent);
    navigate(path);
  };

  const selectItem = (item: PaletteItem) => {
    if (item.kind === 'quick-add') {
      void createQuickTask(item);
      return;
    }
    const remember = (entry: RecentEntry) => {
      if (shortcutsEnabled) recordRecent(userId, entry);
    };
    if (item.kind === 'recent') {
      const { recent, path } = item;
      if (recent.kind === 'task' && tasksLoaded && !taskIndex.some((entry) => entry.task.id === recent.id)) {
        dropRecent(recent);
        return;
      }
      if (recent.kind === 'notebook' || recent.kind === 'turmaNote') {
        void openRemoteRecent(recent, path);
        return;
      }
      setIsOpen(false);
      remember(recent);
      if (recent.id === SHORTCUTS_COMMAND_ID) window.dispatchEvent(new Event(OPEN_SHORTCUTS_HELP_EVENT));
      else navigate(path);
      return;
    }
    setIsOpen(false);
    if (item.kind === 'nav') {
      if (item.id === SHORTCUTS_COMMAND_ID) {
        window.dispatchEvent(new Event(OPEN_SHORTCUTS_HELP_EVENT));
      } else {
        remember({ kind: 'nav', id: item.id });
        navigate(item.path);
      }
    } else if (item.kind === 'task') {
      remember({ kind: 'task', id: item.task.id, label: item.label });
      navigate(`/tasks?open=${item.task.id}`);
    } else if (item.kind === 'turmaNote') {
      remember({ kind: 'turmaNote', id: item.note.id, parentId: item.note.turmaId, label: item.label });
      navigate(turmaNotePath(item.note.turmaId, item.note.id));
    } else {
      // ?entry=<id>: o Notebook reage ao parametro mesmo quando ja esta
      // aberto (antes ia por sessionStorage, lido so no mount: ja em
      // /notebook nada acontecia e um snapshot antigo abria mais tarde) e
      // pede a versao atual da entrada ao servidor.
      remember({ kind: 'notebook', id: item.entry.id, label: item.label });
      navigate(notebookEntryPath(item.entry.id));
    }
  };

  const actionContext = { hasActiveSession: activeSession !== null };

  const runTaskAction = async (task: Task, id: PaletteTaskActionId) => {
    setIsOpen(false);
    if (id === 'done') {
      await completeOne(task);
    } else if (id === 'postpone') {
      await rescheduleToTomorrow(null, task);
    } else {
      // A sessao e criada ja aqui (a pagina Focus nao recebe a task por URL);
      // o cronometro e o cartao do Focus mostram a sessao a correr.
      const started = await startStudySession({ taskId: task.id, areaId: task.areaId });
      if (started) navigate('/focus');
      else notify(t('paletteActions.focusFailed'), 'error');
    }
  };

  return { isCreating, createError, setCreateError, selectItem, runTaskAction, actionContext };
}
