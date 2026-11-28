// Static "go to page" commands - mirrors the routes in AppRouter.tsx and
// the admin gating already used in Navbar.tsx (role === 'ADMIN'). Kept as
// a plain array here rather than trying to derive it from AppRouter's JSX
// at runtime - that would add real complexity (walking Route elements) to
// save maintaining what is, in practice, a short and rarely-changing list.
export interface NavCommand {
  id: string;
  labelKey: string;
  path: string;
  adminOnly?: boolean;
  // Palavras extra que tambem encontram este comando (funcionalidades que
  // vivem dentro da pagina, em EN e PT). Minusculas.
  keywords?: string[];
}

// Entrada sem rota: abre a ajuda de atalhos (ShortcutsHelpModal, no Host).
export const SHORTCUTS_COMMAND_ID = 'nav-shortcuts';

export const NAV_COMMANDS: NavCommand[] = [
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
  {
    id: 'nav-single-task-mode',
    labelKey: 'singleTaskMode.paletteLabel',
    path: '/dashboard?single=on',
    keywords: ['single task', 'one task', 'uma tarefa', 'most urgent', 'mais urgente', 'challenge', 'desafio', 'focus', 'foco'],
  },
  { id: 'nav-tasks', labelKey: 'nav.tasks', path: '/tasks', keywords: ['search tasks', 'pesquisar tarefas', 'filter', 'filtrar', 'overdue', 'atrasadas'] },
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
    id: 'nav-tasks-matrix',
    labelKey: 'eisenhower.paletteLabel',
    path: '/tasks?view=matrix',
    keywords: ['eisenhower', 'matrix', 'matriz', 'urgent', 'urgente', 'important', 'importante', 'quadrants'],
  },
  {
    id: 'nav-tasks-timeline',
    labelKey: 'timeline.paletteLabel',
    path: '/tasks?view=timeline',
    keywords: ['gantt', 'timeline', 'cronograma', 'linha do tempo', 'schedule', 'deadlines', 'prazos'],
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
  { id: 'schedule-add-class', labelKey: 'palette.addClass', path: '/schedule?add=class', keywords: ['add class', 'new class', 'nova aula', 'adicionar aula', 'timetable', 'horario'] },
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
    id: 'nav-risk',
    labelKey: 'courseRisk.page.title',
    path: '/risk',
    keywords: ['risk', 'risco', 'chance', 'probability', 'probabilidade', 'pass', 'passar', 'fail', 'chumbar', 'chumbo', 'passing', 'aprovacao', 'aprovação', 'courses', 'cadeiras', 'estimate'],
  },
  {
    id: 'nav-report-card',
    labelKey: 'reportCard.title',
    path: '/report-card',
    keywords: ['csv', 'descarregar', 'report card', 'transcript', 'boletim', 'pauta', 'grades', 'notas', 'semester', 'semestre', 'print', 'imprimir', 'pdf', 'credits', 'ects', 'grade improvement', 'improve grade', 'melhoria de nota', 'melhorar nota'],
  },
  {
    id: 'nav-period-review',
    labelKey: 'periodReview.title',
    path: '/period-review',
    keywords: ['period in review', 'wrapped', 'recap', 'year in review', 'resumo', 'resumo anual', 'balanco', 'balanço', 'semester recap', 'highlights', 'stats', 'streak', 'best day'],
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
  {
    id: SHORTCUTS_COMMAND_ID,
    labelKey: 'paletteShortcuts.title',
    path: '',
    keywords: ['shortcuts', 'keyboard', 'atalhos', 'teclas', 'teclado', 'hotkeys'],
  },
  { id: 'nav-status', labelKey: 'status.palette', path: '/status', keywords: ['status', 'health', 'uptime', 'down', 'outage', 'estado', 'servidor', 'server', 'online'] },
  { id: 'nav-changelog', labelKey: 'nav.changelog', path: '/changelog' },
  { id: 'nav-class-invites', labelKey: 'turma.invites.title', path: '/classes', keywords: ['invite', 'convite', 'turma', 'class', 'join', 'entrar'] },
  { id: 'nav-finance', labelKey: 'finance.title', path: '/finance', keywords: ['finance', 'financas', 'money', 'dinheiro', 'budget', 'orcamento', 'expenses', 'despesas', 'income', 'salario', 'savings', 'poupanca', 'wishlist', 'investment', 'balance', 'saldo', 'charts', 'graficos', 'analytics'] },
  { id: 'finance-add-expense', labelKey: 'finance.palette.addExpense', path: '/finance?add=expense', keywords: ['expense', 'despesa', 'gasto', 'spent', 'coffee', 'cafe', 'subscription', 'subscricao', 'leisure', 'lazer'] },
  { id: 'finance-add-income', labelKey: 'finance.palette.addIncome', path: '/finance?add=income', keywords: ['income', 'salary', 'salario', 'ordenado', 'receita', 'pay day', 'owed', 'divida', 'deve', 'emprestimo', 'loan', 'interest', 'juros'] },
  { id: 'finance-add-holding', labelKey: 'finance.palette.addHolding', path: '/finance?add=holding', keywords: ['investment', 'investimento', 'etf', 'stock', 'acao', 'crypto', 'cripto', 'vwce', 'shares'] },
  { id: 'finance-add-account', labelKey: 'finance.palette.addAccount', path: '/finance?add=account', keywords: ['account', 'conta', 'bank', 'banco', 'wallet', 'carteira'] },
  { id: 'finance-toggle-privacy', labelKey: 'finance.palette.togglePrivacy', path: '/finance?privacy=toggle', keywords: ['privacy', 'privacidade', 'hide', 'esconder', 'mask', 'mostrar', 'show', 'values', 'valores', 'money', 'dinheiro', 'discreet', 'discreto'] },
  { id: 'finance-export-csv', labelKey: 'financeExport.palette', path: '/finance?export=csv', keywords: ['export', 'exportar', 'csv', 'download', 'descarregar', 'spreadsheet', 'folha de calculo', 'money', 'dinheiro', 'finance', 'financas'] },
  { id: 'finance-import-csv', labelKey: 'financeImport.palette', path: '/finance?import=csv', keywords: ['import', 'importar', 'csv', 'upload', 'carregar', 'spreadsheet', 'folha de calculo', 'restore', 'restaurar', 'money', 'dinheiro', 'finance', 'financas'] },
  { id: 'nav-personal-notes', labelKey: 'notes.title', path: '/notes', keywords: ['notes', 'notas', 'reminder', 'lembrete', 'remind me', 'todo', 'memo'] },
  { id: 'nav-my-feedback', labelKey: 'feedback.mine.title', path: '/my-feedback', keywords: ['feedback', 'reply', 'replies', 'resposta', 'sugestao', 'suggestion'] },
  { id: 'feedback-send', labelKey: 'palette.sendFeedback', path: '/my-feedback?send=1', keywords: ['send feedback', 'enviar feedback', 'bug', 'sugestao', 'suggestion', 'report'] },
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
  { id: 'nav-shared-with-me', labelKey: 'nav.sharedWithMe', path: '/social?tab=shared', keywords: ['shared', 'partilhado', 'lessons', 'notes', 'shared quizzes', 'quizzes partilhados', 'quiz'] },
  { id: 'nav-my-shares', labelKey: 'social.tab.mine', path: '/social?tab=mine', keywords: ['my shares', 'partilhas', 'links', 'share', 'share quiz', 'partilhar quiz'] },
  { id: 'nav-task-packs', labelKey: 'nav.taskPacks', path: '/task-packs', keywords: ['share tasks', 'import'] },
  { id: 'nav-areas', labelKey: 'nav.areas', path: '/areas', keywords: ['courses', 'subjects', 'propose', 'select courses', 'selecionar disciplinas', 'select', 'selecionar', 'bulk', 'em massa', 'approval rules', 'regras de aprovacao', 'custom rules', 'regras personalizadas', 'teacher', 'professor', 'docente'] },
  { id: 'nav-areas-select', labelKey: 'nav.areasSelect', path: '/areas?select=1', keywords: ['bulk', 'em massa', 'approval rules', 'regras de aprovacao', 'select all', 'selecionar tudo', 'multiple', 'varias'] },
  { id: 'nav-flashcards-test', labelKey: 'flashcardTest.paletteLabel', path: '/flashcards?test=1', keywords: ['practice test', 'teste', 'multiple choice', 'escolha multipla', 'flashcards'] },
  { id: 'nav-flashcards', labelKey: 'nav.flashcards', path: '/flashcards', keywords: ['flashcards', 'cards', 'cartoes', 'revisao', 'review', 'spaced repetition', 'repeticao espacada', 'study', 'estudar', 'anki', 'leech', 'hard cards', 'dificeis', 'forecast', 'previsao', 'reverse card', 'inversa', 'search cards', 'pesquisar cartoes', 'tsv', 'export'] },
  { id: 'nav-quizzes', labelKey: 'nav.quizzes', path: '/quizzes', keywords: ['quiz', 'quizzes', 'teste', 'exame', 'exam', 'practice', 'pratica', 'perguntas', 'questions', 'multiple choice', 'escolha multipla', 'study', 'estudar', 'calculo', 'calculation'] },
  { id: 'quizzes-prompt', labelKey: 'quizzes.palette.prompt', path: '/quizzes?open=prompt', keywords: ['prompt', 'ai', 'ia', 'chatgpt', 'claude', 'gemini', 'generate quiz', 'gerar quiz', 'criar quiz', 'copy prompt', 'copiar prompt'] },
  { id: 'quizzes-upload', labelKey: 'quizzes.palette.upload', path: '/quizzes?open=upload', keywords: ['upload', 'carregar', 'import', 'importar', 'json', 'quiz file', 'ficheiro'] },
  { id: 'nav-users', labelKey: 'nav.admin.users', path: '/users', adminOnly: true },
  { id: 'nav-task-types', labelKey: 'nav.admin.taskTypes', path: '/task-types', adminOnly: true },
  { id: 'nav-security', labelKey: 'nav.admin.security', path: '/security', adminOnly: true },
  { id: 'nav-appeals', labelKey: 'nav.admin.appeals', path: '/appeals', adminOnly: true },
  { id: 'nav-pads-admin', labelKey: 'nav.admin.pads', path: '/pads-admin', adminOnly: true, keywords: ['moderation', 'moderacao', 'pads', 'dontpad'] },
  { id: 'nav-feedback', labelKey: 'nav.admin.feedback', path: '/feedback', adminOnly: true },
];
