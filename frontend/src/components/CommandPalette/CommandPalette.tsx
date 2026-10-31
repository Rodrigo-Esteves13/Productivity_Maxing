import { useEffect, useMemo, useRef, useState, type Dispatch, type KeyboardEvent as ReactKeyboardEvent, type SetStateAction } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { createTask, getTaskMetadata, getUserAreas, getUserTasks } from '../../api/userService';
import { searchNotebook } from '../../api/notebookService';
import { searchTurmaNotes } from '../../api/turmasService';
import { SECTION_LABEL_KEY, owningPage } from '../../lib/siteMap';
import { notebookEntryPath, turmaNotePath } from '../../lib/appLinks';
import {
  matchAreaInText,
  parseQuickAddTask,
  quickAddToIsoDate,
  type QuickAddPriority,
} from '../../lib/parseQuickAddTask';
import { getLastUsedAreaId, setLastUsedAreaId } from '../../lib/lastUsedArea';
import { foldText, snippetAround, type TextSnippet } from '../../lib/textSearch';
import type { Area, Task, NotebookSearchResult, TurmaNoteSearchResult } from '../../types/models';
import { PlusIcon, SearchIcon } from '../UI/Icons';
import { ACADEMIC_TASK_TYPE_KEY } from '../../lib/constants';
import { useI18n } from '../../i18n/useI18n';
import { useCatalogLabel } from '../../hooks/useCatalogLabel';
import { useEnumLabel } from '../../hooks/useEnumLabel';

// Static "go to page" commands - mirrors the routes in AppRouter.tsx and
// the admin gating already used in Navbar.tsx (role === 'ADMIN'). Kept as
// a plain array here rather than trying to derive it from AppRouter's JSX
// at runtime - that would add real complexity (walking Route elements) to
// save maintaining what is, in practice, a short and rarely-changing list.
interface NavCommand {
  id: string;
  labelKey: string;
  path: string;
  adminOnly?: boolean;
  // Palavras extra que tambem encontram este comando (funcionalidades que
  // vivem dentro da pagina, em EN e PT). Minusculas.
  keywords?: string[];
}

const NAV_COMMANDS: NavCommand[] = [
  {
    id: 'nav-dashboard',
    labelKey: 'nav.dashboard',
    path: '/dashboard',
    keywords: ['today', 'hoje', 'next class', 'proxima aula', 'due today', 'study block', 'bloco de estudo'],
  },
  {
    id: 'nav-test-gaps',
    labelKey: 'widget.testGaps',
    path: '/dashboard',
    keywords: ['tests', 'testes', 'frequencias', 'frequências', 'exams', 'exames', 'gap', 'intervalo', 'between', 'entre', 'spacing'],
  },
  {
    id: 'nav-exam-mode',
    labelKey: 'examMode.paletteLabel',
    path: '/dashboard?exam=on',
    keywords: ['exam', 'exams', 'exame', 'exames', 'tests', 'testes', 'countdown', 'semana de exames', 'focus'],
  },
  {
    id: 'nav-plan-mode',
    labelKey: 'planMode.paletteLabel',
    path: '/dashboard?plan=on',
    keywords: ['plan', 'plano', 'what if', 'e se', 'target', 'alvo', 'projection', 'projecao', 'expected grade', 'nota esperada'],
  },
  { id: 'nav-tasks', labelKey: 'nav.tasks', path: '/tasks' },
  {
    id: 'nav-task-templates',
    labelKey: 'taskTemplates.paletteLabel',
    path: '/tasks?new=1',
    keywords: ['template', 'templates', 'modelo', 'modelos', 'reuse', 'reutilizar', 'checklist', 'new task'],
  },
  {
    id: 'nav-tasks-board',
    labelKey: 'board.paletteLabel',
    path: '/tasks?view=board',
    keywords: ['kanban', 'board', 'quadro', 'columns', 'colunas', 'status', 'estado', 'drag'],
  },
  {
    id: 'nav-focus',
    labelKey: 'nav.focus',
    path: '/focus',
    keywords: ['study blocks', 'pomodoro', 'timer', 'estudo', 'blocos'],
  },
  {
    id: 'nav-schedule',
    labelKey: 'nav.schedule',
    path: '/schedule',
    keywords: ['timetable', 'classes', 'calendar feed', 'import', 'horario'],
  },
  {
    id: 'nav-schedule-month',
    labelKey: 'schedule.month.paletteLabel',
    path: '/schedule?view=month',
    keywords: ['month', 'monthly', 'mes', 'mensal', 'calendar', 'calendario', 'exams', 'exames', 'deadlines', 'prazos'],
  },
  {
    id: 'nav-attendance',
    labelKey: 'attendance.title',
    path: '/schedule',
    keywords: ['attendance', 'presencas', 'presenças', 'faltas', 'absences', 'missed classes', 'aulas', 'absence limit', 'limite de faltas'],
  },
  {
    id: 'nav-study-vs-class',
    labelKey: 'studyVsClass.title',
    path: '/schedule',
    keywords: ['study hours', 'class hours', 'horas de estudo', 'horas letivas', 'estudo vs aulas', 'per course', 'por cadeira'],
  },
  {
    id: 'nav-work-shifts',
    labelKey: 'palette.workShifts',
    path: '/schedule',
    keywords: ['folga', 'folgas', 'days off', 'day off', 'trabalho', 'work', 'turnos', 'shifts', 'commitments', 'replicate'],
  },
  {
    id: 'nav-schedule-changes',
    labelKey: 'scheduleChanges.title',
    path: '/schedule',
    keywords: ['holidays', 'vacation', 'ferias', 'férias', 'feriado', 'feriados', 'public holiday', 'time off', 'day off', 'folga', 'exception', 'excecao', 'exceção', 'change shift', 'mudar turno', 'teacher absent', 'professor faltou', 'cancelled class', 'aula cancelada', 'sem aula'],
  },
  { id: 'nav-review', labelKey: 'nav.review', path: '/review' },
  {
    id: 'nav-wellbeing',
    labelKey: 'nav.wellbeing',
    path: '/wellbeing',
    keywords: ['mood', 'humor', 'mental', 'stress', 'energy', 'energia', 'medication', 'medicine', 'medicacao', 'medicação', 'remedio', 'pills', 'comprimidos', 'pharmacy', 'farmacia', 'as needed', 'se necessario', 'sos', 'emergency', 'emergencia', 'emergência', 'crisis', 'crise', 'helpline', 'linha de apoio', 'history', 'historico', 'adherence', 'blood', 'sangue', 'dador', 'donor', 'donation', 'dadiva'],
  },
  {
    id: 'nav-blood-donations',
    labelKey: 'wellbeing.blood.title',
    path: '/wellbeing#blood',
    keywords: ['blood', 'sangue', 'dador', 'donor', 'donation', 'dadiva', 'plasma'],
  },
  {
    id: 'nav-medication-history',
    labelKey: 'wellbeing.history.title',
    path: '/wellbeing#medication-history',
    keywords: ['medication history', 'historico', 'adherence', 'weekly', 'monthly', 'semanal', 'mensal'],
  },
  {
    id: 'nav-ratings',
    labelKey: 'ratings.title',
    path: '/ratings',
    keywords: ['ratings', 'teacher', 'professor', 'docente', 'like', 'liked', 'gosto', 'course', 'cadeira', 'feelings', 'correlation', 'correlacao', 'correlação', 'quadrant', 'grades'],
  },
  {
    id: 'nav-report-card',
    labelKey: 'reportCard.title',
    path: '/report-card',
    keywords: ['report card', 'transcript', 'boletim', 'pauta', 'grades', 'notas', 'semester', 'semestre', 'print', 'imprimir', 'pdf', 'credits', 'ects'],
  },
  {
    id: 'nav-turmas',
    labelKey: 'nav.turmas',
    path: '/classes',
    keywords: ['turma', 'class', 'classmates', 'colegas', 'delegado', 'group', 'grupo', 'invite code', 'codigo', 'announcements', 'avisos', 'shared files', 'ficheiros'],
  },
  {
    id: 'nav-pads',
    labelKey: 'nav.pads',
    path: '/pad',
    keywords: ['pad', 'dontpad', 'notepad', 'bloco', 'shared text', 'texto partilhado', 'scratch', 'rascunho'],
  },
  {
    id: 'nav-notebook',
    labelKey: 'nav.notebook',
    path: '/notebook',
    keywords: ['whiteboard', 'quadro', 'photos', 'fotos', 'share', 'shared lesson', 'caderno', 'auto save', 'autosave', 'undo', 'private', 'privado'],
  },
  {
    id: 'nav-profile',
    labelKey: 'nav.profile',
    path: '/profile',
    keywords: ['avatar', 'photo', 'google calendar', 'theme', 'language', '2fa', 'password', 'notifications', 'push', 'reminders', 'deadline', 'lembretes', 'prazos'],
  },
  {
    id: 'nav-install-app',
    labelKey: 'install.title',
    path: '/profile',
    keywords: ['install', 'instalar', 'pwa', 'home screen', 'ecra principal', 'ecrã principal', 'add to home screen', 'iphone', 'android', 'app'],
  },
  {
    id: 'nav-devices',
    labelKey: 'devices.title',
    path: '/devices',
    keywords: ['devices', 'dispositivos', 'sessions', 'sessoes', 'sessões', 'sign out', 'log out', 'terminar sessao', 'terminar sessão', 'logout', 'security', 'seguranca', 'segurança', 'browser', 'phone', 'telemovel', 'telemóvel', 'lost phone'],
  },
  {
    id: 'nav-approval-rules',
    labelKey: 'approvalRules.palette',
    path: '/dashboard?approvalRules=on',
    keywords: ['approval', 'aprovacao', 'aprovação', 'pass mark', 'nota minima', 'nota mínima', 'rounding', 'arredondamento', 'scale', 'escala', 'exam track', 'recurso', 'regras', 'rules', 'ismai', 'chumbo', 'fail'],
  },
  { id: 'nav-changelog', labelKey: 'nav.changelog', path: '/changelog' },
  { id: 'nav-class-invites', labelKey: 'turma.invites.title', path: '/classes', keywords: ['invite', 'convite', 'turma', 'class', 'join', 'entrar'] },
  { id: 'nav-finance', labelKey: 'finance.title', path: '/finance', keywords: ['finance', 'financas', 'money', 'dinheiro', 'budget', 'orcamento', 'expenses', 'despesas', 'income', 'salario', 'savings', 'poupanca', 'wishlist', 'investment'] },
  { id: 'nav-personal-notes', labelKey: 'notes.title', path: '/notes', keywords: ['notes', 'notas', 'reminder', 'lembrete', 'remind me', 'todo', 'memo'] },
  { id: 'nav-my-feedback', labelKey: 'feedback.mine.title', path: '/my-feedback', keywords: ['feedback', 'reply', 'replies', 'resposta', 'sugestao', 'suggestion'] },
  { id: 'nav-developer', labelKey: 'nav.developer', path: '/developer' },
  { id: 'nav-agent', labelKey: 'nav.agent', path: '/agent' },
  { id: 'nav-social', labelKey: 'nav.social', path: '/social', keywords: ['friends', 'amigos', 'friend code'] },
  {
    id: 'nav-add-friend',
    labelKey: 'friendLink.crumb',
    path: '/social?tab=friends',
    keywords: ['add friend', 'adicionar amigo', 'invite', 'convidar', 'email', 'friend link', 'link de amizade', 'share link', 'partilhar link'],
  },
  { id: 'nav-social-requests', labelKey: 'palette.socialRequests', path: '/social?tab=requests', keywords: ['invitations', 'convites', 'pedidos', 'requests'] },
  { id: 'nav-shared-with-me', labelKey: 'nav.sharedWithMe', path: '/social?tab=shared', keywords: ['shared', 'partilhado', 'lessons', 'notes'] },
  { id: 'nav-my-shares', labelKey: 'social.tab.mine', path: '/social?tab=mine', keywords: ['my shares', 'partilhas', 'links', 'share'] },
  { id: 'nav-task-packs', labelKey: 'nav.taskPacks', path: '/task-packs', keywords: ['share tasks', 'import'] },
  { id: 'nav-areas', labelKey: 'nav.areas', path: '/areas', keywords: ['courses', 'subjects', 'propose'] },
  { id: 'nav-users', labelKey: 'nav.admin.users', path: '/users', adminOnly: true },
  { id: 'nav-task-types', labelKey: 'nav.admin.taskTypes', path: '/task-types', adminOnly: true },
  { id: 'nav-security', labelKey: 'nav.admin.security', path: '/security', adminOnly: true },
  { id: 'nav-appeals', labelKey: 'nav.admin.appeals', path: '/appeals', adminOnly: true },
  { id: 'nav-pads-admin', labelKey: 'nav.admin.pads', path: '/pads-admin', adminOnly: true, keywords: ['moderation', 'moderacao', 'pads', 'dontpad'] },
  { id: 'nav-feedback', labelKey: 'nav.admin.feedback', path: '/feedback', adminOnly: true },
];

const MAX_TASK_RESULTS = 6;
const MAX_NOTEBOOK_RESULTS = 6;
const MAX_TURMA_NOTE_RESULTS = 4;
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

// Palavras que identificam cada nivel no catalogo de prioridades.
const PRIORITY_MATCH: Record<QuickAddPriority, string[]> = {
  HIGH: ['high', 'alta', 'urgent'],
  MEDIUM: ['medium', 'media', 'média'],
  LOW: ['low', 'baixa'],
};

type PaletteItem =
  | { kind: 'nav'; id: string; label: string; path: string }
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

interface CommandPaletteProps {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
}

// Carregado a pedido pelo CommandPaletteHost (que tem o Ctrl+K e o evento
// do botao de pesquisa): este ficheiro e pesado e nao precisa de ir no JS
// que abre a app.
export default function CommandPalette({ isOpen, setIsOpen }: CommandPaletteProps) {
  const { isAuthenticated, user } = useAuth();
  const { t } = useI18n();
  const { catalogLabel } = useCatalogLabel();
  const enumLabel = useEnumLabel();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [notebookResults, setNotebookResults] = useState<NotebookSearchResult[]>([]);
  const [turmaNoteResults, setTurmaNoteResults] = useState<TurmaNoteSearchResult[]>([]);
  // null = not fetched yet (lazy, same as tasks); [] = fetched, none exist.
  const [areas, setAreas] = useState<Area[] | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  // Listas pedidas no primeiro open. Uma falha (ex: arranque a frio do
  // Render) ja nao fica como resposta final: volta a pedir no open seguinte.
  // E de quem sao: depois de logout + login com outra conta (SPA, sem
  // reload) as listas da conta anterior nao podem ser usadas (F-07).
  const tasksFailedRef = useRef(false);
  const areasFailedRef = useRef(false);
  const listsUserIdRef = useRef<string | null>(null);

  // O Ctrl+K e o evento do botao da Navbar vivem no CommandPaletteHost.

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
    const currentUserId = user?.id ?? null;
    const otherUser = listsUserIdRef.current !== currentUserId;
    listsUserIdRef.current = currentUserId;
    if (otherUser) {
      setTasks(null);
      setAreas(null);
    }

    if (tasks === null || otherUser || tasksFailedRef.current) {
      tasksFailedRef.current = false;
      getUserTasks()
        .then(setTasks)
        .catch(() => {
          tasksFailedRef.current = true;
          setTasks([]);
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

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, setIsOpen]);

  // Titulo, notas e passos de cada task ja sem acentos/maiusculas: calcula
  // uma vez por carga, nao a cada tecla.
  const taskIndex = useMemo(
    () =>
      (tasks ?? []).map((task) => ({
        task,
        title: foldText(task.title),
        notes: task.notes ? foldText(task.notes) : '',
        subtasks: (task.subtasks ?? []).map((subtask) => foldText(subtask.title)),
      })),
    [tasks],
  );

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
    return [...navMatches, ...taskMatches, ...notebookMatches, ...turmaNoteMatches, ...quickAddItems];
  }, [query, taskIndex, notebookResults, turmaNoteResults, user, areas, t]);

  // Clamp instead of reset-on-every-keystroke - keeps the highlighted row
  // stable when it's still a valid index after the result list shrinks.
  const clampedIndex = Math.min(activeIndex, Math.max(items.length - 1, 0));

  const createQuickTask = async (item: Extract<PaletteItem, { kind: 'quick-add' }>) => {
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

  // Paginas mostram a secao do mapa (Estudo, Em conjunto...), a mesma do
  // trilho no topo de cada pagina.
  const navSectionLabel = (path: string) => {
    const section = owningPage(path)?.section;
    return section ? t(SECTION_LABEL_KEY[section]) : t('palette.kind.nav');
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
    } else if (item.kind === 'turmaNote') {
      navigate(turmaNotePath(item.note.turmaId, item.note.id));
    } else {
      // ?entry=<id>: o Notebook reage ao parametro mesmo quando ja esta
      // aberto (antes ia por sessionStorage, lido so no mount: ja em
      // /notebook nada acontecia e um snapshot antigo abria mais tarde) e
      // pede a versao atual da entrada ao servidor.
      navigate(notebookEntryPath(item.entry.id));
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
      className="motion-backdrop fixed inset-0 z-50 flex items-start justify-center pt-[15vh] p-4 bg-black/80 backdrop-blur-sm"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="motion-modal w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden"
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
            placeholder={t('palette.placeholder')}
            aria-label={t('palette.placeholder')}
            className="flex-1 bg-transparent text-white placeholder:text-neutral-500 outline-none text-sm"
          />
          <kbd className="hidden sm:inline text-[10px] text-neutral-500 border border-neutral-700 rounded px-1.5 py-0.5">
            {t('ui.esc')}
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto py-2">
          {items.length === 0 && (
            <p className="px-4 py-3 text-sm text-neutral-500">{t('palette.noMatches')}</p>
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
                      {isCreating ? t('palette.creating') : t('palette.create', { title: item.title })}
                    </span>
                  </span>
                  <span className="text-[10px] text-neutral-500 shrink-0 text-right">
                    {noArea
                      ? t('palette.needArea')
                      : t('palette.meta', {
                          area: item.area?.name ?? '...',
                          date: dateLabel,
                          // Rotulos traduzidos (antes mostrava as chaves cruas,
                          // ex: "academico, medium").
                          details: `${catalogLabel('taskType', QUICK_ADD_TASK_TYPE, null)}, ${enumLabel(QUICK_ADD_DIFFICULTY)}${
                            item.priority ? `, ${t('palette.priorityTag', { level: catalogLabel('priority', item.priority, null) })}` : ''
                          }`,
                        })}
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
                <span className="min-w-0">
                  <span className="block truncate">{item.label}</span>
                  {item.kind === 'task' && item.detail && (
                    <span className="block truncate text-xs text-neutral-500">
                      <span className="text-neutral-400">{item.detail.prefix} </span>
                      {item.detail.snippet.before}
                      <mark className="bg-transparent text-violet-300">{item.detail.snippet.match}</mark>
                      {item.detail.snippet.after}
                    </span>
                  )}
                </span>
                <span className="text-[10px] uppercase tracking-wide text-neutral-500 shrink-0">
                  {item.kind === 'nav' ? navSectionLabel(item.path) : t(`palette.kind.${item.kind}`)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
