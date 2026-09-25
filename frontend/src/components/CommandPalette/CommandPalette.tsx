import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { getUserTasks } from '../../api/userService';
import { searchNotebook } from '../../api/notebookService';
import { setPendingNotebookEntry } from '../../lib/pendingNotebookEntry';
import type { Task, NotebookSearchResult } from '../../types/models';
import { SearchIcon } from '../UI/Icons';

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

type PaletteItem =
  | { kind: 'nav'; id: string; label: string; path: string }
  | { kind: 'task'; id: string; label: string; task: Task }
  | { kind: 'notebook'; id: string; label: string; entry: NotebookSearchResult };

export default function CommandPalette() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [notebookResults, setNotebookResults] = useState<NotebookSearchResult[]>([]);
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
    const q = query.trim().toLowerCase();
    const isAdmin = user?.role === 'ADMIN';

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

    return [...navMatches, ...taskMatches, ...notebookMatches];
  }, [query, tasks, notebookResults, user]);

  // Clamp instead of reset-on-every-keystroke - keeps the highlighted row
  // stable when it's still a valid index after the result list shrinks.
  const clampedIndex = Math.min(activeIndex, Math.max(items.length - 1, 0));

  const selectItem = (item: PaletteItem) => {
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
            placeholder="Go to a page, or search a task or notebook entry..."
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
          {items.map((item, index) => (
            <button
              key={`${item.kind}-${item.id}`}
              type="button"
              onClick={() => selectItem(item)}
              onMouseEnter={() => setActiveIndex(index)}
              className={`w-full flex items-center justify-between gap-3 text-left px-4 py-2 text-sm transition-colors ${
                index === clampedIndex
                  ? 'bg-violet-500/15 text-white'
                  : 'text-neutral-300 hover:bg-neutral-800'
              }`}
            >
              <span className="truncate">{item.label}</span>
              <span className="text-[10px] uppercase tracking-wide text-neutral-500 shrink-0">
                {item.kind === 'nav' ? 'Go to' : item.kind === 'task' ? 'Task' : 'Notebook'}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
