import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { createTask, getUserAreas, getUserTasks } from '../../api/userService';
import { searchNotebook } from '../../api/notebookService';
import { setPendingNotebookEntry } from '../../lib/pendingNotebookEntry';
import { parseQuickAddTask, quickAddToIsoDate } from '../../lib/parseQuickAddTask';
import { getLastUsedAreaId, setLastUsedAreaId } from '../../lib/lastUsedArea';
import type { Area, Task, NotebookSearchResult } from '../../types/models';
import { PlusIcon, SearchIcon } from '../UI/Icons';
import { ACADEMIC_TASK_TYPE_KEY } from '../../lib/constants';

// Static "go to page" commands - mirrors the routes in AppRouter.tsx and
// the admin gating already used in Navbar.tsx (role === 'ADMIN'). Kept as
// a plain array here rather than trying to derive it from AppRouter's JSX
// at runtime - that would add real complexity (walking Route elements) to
// save maintaining what is, in practice, a short and rarely-changing list.
interface NavCommand {
  id: string;
  label: string;
  path: string;
  adminOnly?: boolean;
}

const NAV_COMMANDS: NavCommand[] = [
  { id: 'nav-dashboard', label: 'Dashboard', path: '/dashboard' },
  { id: 'nav-tasks', label: 'Tasks', path: '/tasks' },
  { id: 'nav-focus', label: 'Focus', path: '/focus' },
  { id: 'nav-schedule', label: 'Schedule', path: '/schedule' },
  { id: 'nav-notebook', label: 'Notebook', path: '/notebook' },
  { id: 'nav-profile', label: 'Profile', path: '/profile' },
  { id: 'nav-developer', label: 'Developer', path: '/developer' },
  { id: 'nav-agent', label: 'Agent', path: '/agent' },
  { id: 'nav-areas', label: 'Areas', path: '/areas', adminOnly: true },
  { id: 'nav-users', label: 'Users', path: '/users', adminOnly: true },
  { id: 'nav-task-types', label: 'Task Types', path: '/task-types', adminOnly: true },
  { id: 'nav-security', label: 'Security', path: '/security', adminOnly: true },
  { id: 'nav-appeals', label: 'Appeals', path: '/appeals', adminOnly: true },
];

const MAX_TASK_RESULTS = 6;
const MAX_NOTEBOOK_RESULTS = 6;
// Ao contrário das tasks (pré-carregadas de uma vez e filtradas
// localmente), o notebook pode ter muitas entradas por Area - por isso
// vai a pedido ao endpoint GET /notebook/search já existente, com debounce
// para não martelar a API a cada tecla premida.
const NOTEBOOK_SEARCH_DEBOUNCE_MS = 250;

// Quick-add defaults. Type matches the Dashboard's own default task type
// (DASHBOARD_TASK_TYPE_KEY) - this is a student app first - and MEDIUM is
// the neutral middle of the Difficulty scale. Both are shown in the row
// so nothing about the created task is a hidden decision, and both are
// one click away from being edited afterwards on the Tasks page.
const QUICK_ADD_TASK_TYPE = ACADEMIC_TASK_TYPE_KEY;
const QUICK_ADD_DIFFICULTY = 'MEDIUM';
// Typing "+" first forces quick-add mode (only the create row is shown),
// so a stray Enter on a normal search can never create a task by accident.
const QUICK_ADD_PREFIX = '+';

type PaletteItem =
  | { kind: 'nav'; id: string; label: string; path: string }
  | { kind: 'task'; id: string; label: string; task: Task }
  | { kind: 'notebook'; id: string; label: string; entry: NotebookSearchResult }
  | {
      kind: 'quick-add';
      id: 'quick-add';
      label: string;
      title: string;
      dateIso: string;
      dateKey: string;
      time: string | null;
      area: Area | null;
    };

export default function CommandPalette() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [notebookResults, setNotebookResults] = useState<NotebookSearchResult[]>([]);
  // null = not fetched yet (lazy, same as tasks); [] = fetched, none exist.
  const [areas, setAreas] = useState<Area[] | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Global Cmd/Ctrl+K to open, from anywhere in the app (not just when
  // something is already focused inside the palette). Escape to close is
  // handled separately below, only while open, same split Modal.tsx uses.
  useEffect(() => {
    if (!isAuthenticated) return;
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuthenticated]);

  // Also opens on a plain DOM CustomEvent - lets the visible search button
  // in Navbar.tsx open the same palette without lifting isOpen state up
  // into a context just for one cross-component trigger. Anyone with
  // mouse-only usage (or who never learns the shortcut) still has a way
  // in - a keyboard-only entry point isn't discoverable on its own.
  useEffect(() => {
    if (!isAuthenticated) return;
    const handleOpenEvent = () => setIsOpen(true);
    window.addEventListener('pmaxing:open-command-palette', handleOpenEvent);
    return () => window.removeEventListener('pmaxing:open-command-palette', handleOpenEvent);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setActiveIndex(0);
    setCreateError('');
    // Autofocus needs a tick - the input isn't in the DOM yet on the same
    // render that flips isOpen to true.
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);

    // Tasks are fetched lazily on first open rather than eagerly on every
    // page load - the palette is opt-in (Cmd/Ctrl+K), no reason to make
    // every page pay for a tasks fetch it might never need. Not
    // re-fetched on subsequent opens in the same session; the task list
    // rarely changes fast enough within one sitting to matter here, and
    // this avoids hammering the API every time someone hits Cmd+K.
    if (tasks === null) {
      getUserTasks()
        .then(setTasks)
        .catch(() => setTasks([]));
    }

    // Same lazy approach for Areas - only needed by quick-add, so it is
    // fetched on first open, not on every page load.
    if (areas === null) {
      getUserAreas()
        .then(setAreas)
        .catch(() => setAreas([]));
    }

    return () => window.clearTimeout(id);
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
    }, NOTEBOOK_SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [isOpen, query]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen]);

  const items = useMemo<PaletteItem[]>(() => {
    const trimmed = query.trim();
    const isQuickAddMode = trimmed.startsWith(QUICK_ADD_PREFIX);
    const quickText = isQuickAddMode ? trimmed.slice(QUICK_ADD_PREFIX.length).trim() : trimmed;
    const q = trimmed.toLowerCase();
    const isAdmin = user?.role === 'ADMIN';

    // Area the new task would land in: last one used via quick-add if it
    // still exists, otherwise the first available.
    let quickArea: Area | null = null;
    if (areas && areas.length > 0) {
      const lastUsedId = getLastUsedAreaId();
      quickArea = areas.find((a) => a.id === lastUsedId) ?? areas[0];
    }

    const quickAddItems: PaletteItem[] = [];
    if (quickText !== '') {
      const parsed = parseQuickAddTask(quickText);
      quickAddItems.push({
        kind: 'quick-add',
        id: 'quick-add',
        label: parsed.title,
        title: parsed.title,
        dateIso: quickAddToIsoDate(parsed.date, parsed.time),
        dateKey: parsed.date,
        time: parsed.time,
        area: quickArea,
      });
    }

    if (isQuickAddMode) return quickAddItems;

    const navMatches: PaletteItem[] = NAV_COMMANDS.filter((c) => !c.adminOnly || isAdmin)
      .filter((c) => q === '' || c.label.toLowerCase().includes(q))
      .map((c) => ({ kind: 'nav', id: c.id, label: c.label, path: c.path }));

    // Task titles only searched once there's a query - with no query,
    // showing 6 arbitrary tasks above the fold isn't useful; the nav
    // commands are.
    const taskMatches: PaletteItem[] =
      q === '' || !tasks
        ? []
        : tasks
            .filter((t) => t.title.toLowerCase().includes(q))
            .slice(0, MAX_TASK_RESULTS)
            .map((t) => ({ kind: 'task', id: t.id, label: t.title, task: t }));

    const notebookMatches: PaletteItem[] =
      q === ''
        ? []
        : notebookResults
            .slice(0, MAX_NOTEBOOK_RESULTS)
            .map((entry) => ({ kind: 'notebook', id: entry.id, label: entry.title, entry }));

    // Quick-add goes LAST, never first: Enter on a normal search must keep
    // opening the top match, not creating a task named after the query.
    return [...navMatches, ...taskMatches, ...notebookMatches, ...quickAddItems];
  }, [query, tasks, notebookResults, user, areas]);

  // Clamp instead of reset-on-every-keystroke - keeps the highlighted row
  // stable when it's still a valid index after the result list shrinks.
  const clampedIndex = Math.min(activeIndex, Math.max(items.length - 1, 0));

  const createQuickTask = async (item: Extract<PaletteItem, { kind: 'quick-add' }>) => {
    if (isCreating || !item.area) return;
    setIsCreating(true);
    setCreateError('');
    try {
      const created: unknown = await createTask({
        areaId: item.area.id,
        title: item.title,
        date: item.dateIso,
        type: QUICK_ADD_TASK_TYPE,
        difficulty: QUICK_ADD_DIFFICULTY,
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
      setCreateError('Could not create the task. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const selectItem = (item: PaletteItem) => {
    if (item.kind === 'quick-add') {
      void createQuickTask(item);
      return;
    }
    setIsOpen(false);
    if (item.kind === 'nav') {
      navigate(item.path);
    } else if (item.kind === 'task') {
      navigate(`/tasks?open=${item.task.id}`);
    } else {
      // A página Notebook filtra as entradas por Area selecionada - não
      // dá para "saltar" direto para uma entrada só com o path, por isso
      // deixamos a entrada pronta a consumir e o próprio Notebook.tsx
      // trata de selecionar a Area certa e abrir a entrada no mount.
      setPendingNotebookEntry(item.entry);
      navigate('/notebook');
    }
  };

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = items[clampedIndex];
      if (item) selectItem(item);
    }
  };

  if (!isAuthenticated || !isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] p-4 bg-black/70 backdrop-blur-sm"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-800">
          <SearchIcon className="shrink-0 text-neutral-500" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Go to a page, search, or type + to add a task..."
            className="flex-1 bg-transparent text-white placeholder:text-neutral-500 outline-none text-sm"
          />
          <kbd className="hidden sm:inline text-[10px] text-neutral-500 border border-neutral-700 rounded px-1.5 py-0.5">
            Esc
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto py-2">
          {items.length === 0 && (
            <p className="px-4 py-3 text-sm text-neutral-500">No matches.</p>
          )}
          {createError && (
            <p role="alert" className="px-4 py-2 text-xs text-red-400">
              {createError}
            </p>
          )}
          {items.map((item, index) => {
            const rowClass = `w-full flex items-center justify-between gap-3 text-left px-4 py-2 text-sm transition-colors ${
              index === clampedIndex
                ? 'bg-violet-500/15 text-white'
                : 'text-neutral-300 hover:bg-neutral-800'
            }`;

            if (item.kind === 'quick-add') {
              const noArea = areas !== null && !item.area;
              const dateLabel = item.time ? `${item.dateKey} ${item.time}` : item.dateKey;
              return (
                <button
                  key="quick-add"
                  type="button"
                  disabled={isCreating || !item.area}
                  onClick={() => selectItem(item)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`${rowClass} disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <PlusIcon className="shrink-0 text-violet-400" />
                    <span className="truncate">
                      {isCreating ? 'Creating...' : `Create "${item.title}"`}
                    </span>
                  </span>
                  <span className="text-[10px] text-neutral-500 shrink-0 text-right">
                    {noArea
                      ? 'Create an Area first'
                      : `${item.area?.name ?? '...'} - ${dateLabel} - ${QUICK_ADD_TASK_TYPE.toLowerCase()}, ${QUICK_ADD_DIFFICULTY.toLowerCase()}`}
                  </span>
                </button>
              );
            }

            return (
              <button
                key={`${item.kind}-${item.id}`}
                type="button"
                onClick={() => selectItem(item)}
                onMouseEnter={() => setActiveIndex(index)}
                className={rowClass}
              >
                <span className="truncate">{item.label}</span>
                <span className="text-[10px] uppercase tracking-wide text-neutral-500 shrink-0">
                  {item.kind === 'nav' ? 'Go to' : item.kind === 'task' ? 'Task' : 'Notebook'}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
