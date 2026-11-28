// Construcao pura dos itens do Ctrl+K: indexacao das tasks, ordem das
// seccoes e limites. Sem React, sem rede e sem localStorage.
import {
  matchAreaInText,
  parseQuickAddTask,
  quickAddToIsoDate,
  type QuickAddPriority,
} from '../../lib/parseQuickAddTask';
import { recentPath, type RecentEntry } from '../../lib/paletteRecents';
import { foldText, snippetAround, type TextSnippet } from '../../lib/textSearch';
import { ACADEMIC_TASK_TYPE_KEY } from '../../lib/constants';
import type { Area, Task, NotebookSearchResult, TurmaNoteSearchResult } from '../../types/models';
import { NAV_COMMANDS } from './navCommands';

export const MAX_TASK_RESULTS = 6;
const RECENT_ID_PREFIX = 'recent';
export const MAX_NOTEBOOK_RESULTS = 6;
export const MAX_TURMA_NOTE_RESULTS = 4;

// Quick-add defaults. Type matches the Dashboard's own default task type
// (DASHBOARD_TASK_TYPE_KEY) - this is a student app first - and MEDIUM is
// the neutral middle of the Difficulty scale. Both are shown in the row
// so nothing about the created task is a hidden decision, and both are
// one click away from being edited afterwards on the Tasks page.
export const QUICK_ADD_TASK_TYPE = ACADEMIC_TASK_TYPE_KEY;
export const QUICK_ADD_DIFFICULTY = 'MEDIUM';
// Typing "+" first forces quick-add mode (only the create row is shown),
// so a stray Enter on a normal search can never create a task by accident.
export const QUICK_ADD_PREFIX = '+';

export type PaletteItem =
  | { kind: 'nav'; id: string; label: string; path: string }
  // Escolhido recentemente (so com a pesquisa vazia). path: reconstruido de
  // kind + id (nunca lido do armazenamento).
  | { kind: 'recent'; id: string; label: string; recent: RecentEntry; path: string }
  // detail: onde apareceu o texto quando nao foi no titulo (notas ou passo).
  | { kind: 'task'; id: string; label: string; task: Task; detail?: { prefix: string; snippet: TextSnippet } }
  | { kind: 'notebook'; id: string; label: string; entry: NotebookSearchResult }
  | { kind: 'turmaNote'; id: string; label: string; note: TurmaNoteSearchResult }
  | {
      kind: 'quick-add';
      id: 'quick-add';
      label: string;
      title: string;
      dateIso: string;
      dateKey: string;
      time: string | null;
      area: Area | null;
      priority: QuickAddPriority | null;
    };

export type QuickAddItem = Extract<PaletteItem, { kind: 'quick-add' }>;

export interface IndexedTask {
  task: Task;
  title: string;
  notes: string;
  subtasks: string[];
}

// Titulo, notas e passos de cada task ja sem acentos/maiusculas.
export function indexTasks(tasks: Task[]): IndexedTask[] {
  return tasks.map((task) => ({
    task,
    title: foldText(task.title),
    notes: task.notes ? foldText(task.notes) : '',
    subtasks: (task.subtasks ?? []).map((subtask) => foldText(subtask.title)),
  }));
}

export interface BuildPaletteItemsInput {
  query: string;
  taskIndex: IndexedTask[];
  // Lista de tasks carregada com sucesso.
  tasksLoaded: boolean;
  notebookResults: NotebookSearchResult[];
  turmaNoteResults: TurmaNoteSearchResult[];
  // null = ainda nao carregadas.
  areas: Area[] | null;
  // Area usada no ultimo quick-add.
  lastUsedAreaId: string | null;
  isAdmin: boolean;
  recents: RecentEntry[];
  shortcutsEnabled: boolean;
  t: (key: string) => string;
}

export function buildPaletteItems({
  query,
  taskIndex,
  tasksLoaded,
  notebookResults,
  turmaNoteResults,
  areas,
  lastUsedAreaId,
  isAdmin,
  recents,
  shortcutsEnabled,
  t,
}: BuildPaletteItemsInput): PaletteItem[] {
  const trimmed = query.trim();
  const isQuickAddMode = trimmed.startsWith(QUICK_ADD_PREFIX);
  const quickText = isQuickAddMode ? trimmed.slice(QUICK_ADD_PREFIX.length).trim() : trimmed;
  const q = trimmed.toLowerCase();

  // Area the new task would land in: last one used via quick-add if it
  // still exists, otherwise the first available.
  let quickArea: Area | null = null;
  if (areas && areas.length > 0) {
    quickArea = areas.find((a) => a.id === lastUsedAreaId) ?? areas[0];
  }

  const quickAddItems: PaletteItem[] = [];
  if (quickText !== '') {
    const parsed = parseQuickAddTask(quickText);
    // Area escrita no texto ("Exame SO ...") ganha a ultima usada.
    const textArea = areas ? matchAreaInText(quickText, areas) : null;
    quickAddItems.push({
      kind: 'quick-add',
      id: 'quick-add',
      label: parsed.title,
      title: parsed.title,
      dateIso: quickAddToIsoDate(parsed.date, parsed.time),
      dateKey: parsed.date,
      time: parsed.time,
      area: textArea ?? quickArea,
      priority: parsed.priority,
    });
  }

  if (isQuickAddMode) return quickAddItems;

  const navMatches: PaletteItem[] = NAV_COMMANDS.filter((c) => !c.adminOnly || isAdmin)
    .map((c) => ({ command: c, label: t(c.labelKey) }))
    .filter(({ command, label }) => q === '' || label.toLowerCase().includes(q) || command.keywords?.some((k) => k.includes(q)))
    .map(({ command, label }) => ({ kind: 'nav', id: command.id, label, path: command.path }));

  // Recentes primeiro, so sem pesquisa. Nav re-resolvido pelo id (rotulo
  // sempre traduzido; sai se ja nao existe ou e so de admin); os outros
  // reconstroem o caminho de kind + id e trazem o rotulo guardado (tasks:
  // o titulo atual, e saem se a lista carregada ja nao as tem). As linhas
  // de nav ja mostradas aqui saem da lista normal para nao repetir.
  const recentMatches: PaletteItem[] = [];
  if (q === '' && shortcutsEnabled) {
    const navById = new Map(navMatches.map((m) => [m.id, m]));
    const taskTitleById = tasksLoaded ? new Map(taskIndex.map((entry) => [entry.task.id, entry.task.title])) : null;
    for (const recent of recents) {
      if (recent.kind === 'nav') {
        const nav = navById.get(recent.id);
        if (nav && nav.kind === 'nav') {
          recentMatches.push({ kind: 'recent', id: `${RECENT_ID_PREFIX}-nav-${recent.id}`, label: nav.label, recent, path: nav.path });
        }
        continue;
      }
      const path = recentPath(recent);
      let label = recent.label;
      if (recent.kind === 'task' && taskTitleById) label = taskTitleById.get(recent.id);
      if (path && label) {
        recentMatches.push({ kind: 'recent', id: `${RECENT_ID_PREFIX}-${recent.kind}-${recent.id}`, label, recent, path });
      }
    }
  }
  const recentNavIds = new Set(recentMatches.flatMap((m) => (m.kind === 'recent' && m.recent.kind === 'nav' ? [m.recent.id] : [])));
  const restNavMatches = navMatches.filter((m) => !recentNavIds.has(m.id));

  // Tasks only searched once there's a query - with no query, showing 6
  // arbitrary tasks above the fold isn't useful; the nav commands are.
  // Titulo primeiro; depois as que so tem o texto nas notas ou num passo,
  // com o excerto onde apareceu (so para as que chegam a ser mostradas).
  const taskMatches: PaletteItem[] = [];
  if (q !== '') {
    const fq = foldText(trimmed);
    const inBody: { task: Task; subtaskIndex: number }[] = [];
    for (const entry of taskIndex) {
      if (entry.title.includes(fq)) {
        taskMatches.push({ kind: 'task', id: entry.task.id, label: entry.task.title, task: entry.task });
      } else if (entry.notes.includes(fq)) {
        inBody.push({ task: entry.task, subtaskIndex: -1 });
      } else {
        const subtaskIndex = entry.subtasks.findIndex((title) => title.includes(fq));
        if (subtaskIndex !== -1) inBody.push({ task: entry.task, subtaskIndex });
      }
    }
    for (const { task, subtaskIndex } of inBody) {
      if (taskMatches.length >= MAX_TASK_RESULTS) break;
      const inNotes = subtaskIndex === -1;
      const snippet = snippetAround(inNotes ? (task.notes ?? '') : (task.subtasks?.[subtaskIndex]?.title ?? ''), fq);
      taskMatches.push({
        kind: 'task',
        id: task.id,
        label: task.title,
        task,
        ...(snippet ? { detail: { prefix: t(inNotes ? 'palette.inNotes' : 'palette.inSubtask'), snippet } } : {}),
      });
    }
    taskMatches.splice(MAX_TASK_RESULTS);
  }

  const notebookMatches: PaletteItem[] =
    q === ''
      ? []
      : notebookResults
          .slice(0, MAX_NOTEBOOK_RESULTS)
          .map((entry) => ({ kind: 'notebook', id: entry.id, label: entry.title, entry }));

  const turmaNoteMatches: PaletteItem[] =
    q === ''
      ? []
      : turmaNoteResults
          .slice(0, MAX_TURMA_NOTE_RESULTS)
          .map((note) => ({ kind: 'turmaNote', id: note.id, label: `${note.title} (${note.turmaName})`, note }));

  // Quick-add goes LAST, never first: Enter on a normal search must keep
  // opening the top match, not creating a task named after the query.
  return [...recentMatches, ...restNavMatches, ...taskMatches, ...notebookMatches, ...turmaNoteMatches, ...quickAddItems];
}
