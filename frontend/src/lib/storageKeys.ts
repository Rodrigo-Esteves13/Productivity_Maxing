// Registo central de tudo o que a app guarda no browser (F-52): evita colisoes
// e decide o que sai ao terminar sessao. Chave nova = entrada nova em
// STORAGE_REGISTRY (storageKeys.test.ts falha se faltar).

export const STORAGE_KEYS = {
  examMode: 'pm-exam-mode',
  singleTaskMode: 'pm-single-task-mode',
  showArchivedTasks: 'pm-show-archived-tasks',
} as const;

// device    = preferencia deste dispositivo (ou estado tecnico): fica sempre.
// userCache = dados de quem tem sessao que se podem perder (recentes, ultima
//             cadeira, rascunhos, caches): sai no logout e quando entra outra
//             conta.
// userDraft = trabalho que so existe neste browser e e irrecuperavel (texto que
//             o servidor nao gravou, quiz a meio): fica no logout, sai quando
//             entra outra conta ou a conta e apagada.
// userKept  = so existe neste browser e perdia-se para sempre: nunca se apaga.
//             Nao esta separado por conta (ver a nota em cada entrada).
// perUser   = a chave ja leva o id da conta (prefixo + id): so sai quando a
//             propria conta e apagada.
export type StorageCategory = 'device' | 'userCache' | 'userDraft' | 'userKept' | 'perUser';

export interface StorageEntry {
  // Chave exata, ou o inicio dela quando `prefix` e true.
  key: string;
  category: StorageCategory;
  prefix?: boolean;
  // Omitido = localStorage.
  session?: boolean;
}

const device = (key: string): StorageEntry => ({ key, category: 'device' });
const userCache = (key: string, extra?: Partial<StorageEntry>): StorageEntry => ({ key, category: 'userCache', ...extra });
const userDraft = (key: string, extra?: Partial<StorageEntry>): StorageEntry => ({ key, category: 'userDraft', ...extra });
const userKept = (key: string): StorageEntry => ({ key, category: 'userKept' });
const perUser = (key: string): StorageEntry => ({ key, category: 'perUser', prefix: true });

// Ultima conta vista neste browser (ver claimUserStorage).
export const STORAGE_OWNER_KEY = 'pmaxing:storage-owner';

// Guardados por conta em `<chave>:<userId>` (F-52). A chave sem id e o formato
// antigo: passa para a conta que a usou por ultimo (ver adoptUnscopedKeys).
export const ACCOUNT_SCOPED_KEYS = {
  taskTemplates: 'pm-task-templates',
  savedFilterViews: 'dashboard-saved-filter-views',
  scheduleImportOptions: 'pmaxing.scheduleImportOptions',
  bestStreak: 'pmaxing.bestStreak',
  gradeTargets: 'pm-grade-targets',
  areaOrder: 'pm-area-order',
  // Quiz: tentativa a meio, erradas ja enviadas para flashcards, ultimas
  // respostas erradas, ultimo exame, "nao perguntar" e sessao de foco.
  quizSession: 'pm-quiz-session',
  quizCardsSent: 'pm-quiz-cards-sent',
  quizLastWrong: 'pm-quiz-last-wrong',
  quizLastExam: 'pm-quiz-last-exam',
  quizFocusOptOut: 'pm-quiz-focus-optout',
  quizFocusSession: 'pm-quiz-focus-session',
} as const;

export const STORAGE_REGISTRY: readonly StorageEntry[] = [
  // Aspeto, acessibilidade, lingua e avisos.
  device('pmaxing-language'),
  device('accent-color'),
  device('accessibility-prefs'),
  device('pm_cookie_notice_dismissed'),
  device('pm-install-dismissed'),
  device('palette-shortcuts-enabled'),
  // Como cada pagina se mostra e como o Focus se comporta (sem conteudo).
  device('dashboard-table-density'),
  device('dashboard-widget-order'),
  device('dashboard-widget-prefs'),
  device('pm-schedule-view'),
  device('pm-tasks-view'),
  device('pm-tasks-sort-mode'),
  device('pm-tasks-sort-direction'),
  device('pm-tasks-table-column-order'),
  device('pm-area-list-prefs'),
  device('pm-notebook-autosave'),
  device('pm-focus-ambient'),
  device('pm-focus-keep-screen-on'),
  device('pm-daily-digest-enabled'),
  device('attendance-absence-limit-pct'),
  device('ects-hours-per-credit'),
  device('no-leisure-days-goal'),
  device('streak-rest-mode'),
  device('pmaxing:test-gaps-mode'),
  device('pmaxing.sharePanelOpen'),
  device(STORAGE_KEYS.examMode),
  device(STORAGE_KEYS.singleTaskMode),
  device(STORAGE_KEYS.showArchivedTasks),
  device('pm-plan-mode'),
  // Modo privacidade: apaga-lo voltava a mostrar os valores no ecra.
  device('pmaxing.finance.privacy'),
  // Estado tecnico: separadores abertos, destino pos-OAuth (expira sozinho e
  // e lido logo a seguir ao login) e o dono deste armazenamento.
  device('pmaxing:live-tabs'),
  device('post-auth-redirect'),
  device(STORAGE_OWNER_KEY),

  // Recentes e ultima escolha.
  userCache('palette-recents'),
  userCache('palette-recents:', { prefix: true }),
  userCache('pmaxing-pad-recents'),
  userCache('pmaxing-quick-add-last-area'),
  userCache('pmaxing-notebook-area'),
  // Rascunhos e trabalho a meio.
  userDraft('pmaxing:notebook-unsaved:', { prefix: true, session: true }),
  userCache('pmaxing:pending-notebook-entry', { session: true }),
  userCache('pmaxing:focus-plan:', { prefix: true }),
  userCache('pmaxing:focus-break'),
  // Marcas de "ja visto", que se voltam a calcular. As conquistas semeiam a
  // base outra vez sem avisar das antigas.
  userCache('pmaxing:last-activity'),
  userCache('pmaxing:onboarding-dismissed'),
  userCache('pmaxing.earnedBadges'),
  userCache('turma-announcements-seen'),
  userCache('pm-daily-digest-', { prefix: true }),
  // Chave antiga do check-in, anterior a ser por conta.
  userCache('pmaxing:lastOverdueCheckDate'),

  // Formato antigo das chaves por conta: so existe ate a primeira conta entrar.
  ...Object.values(ACCOUNT_SCOPED_KEYS).map(userKept),

  perUser('greeting-prefs:'),
  perUser('pmaxing:lastOverdueCheckDate:'),
  perUser('pm-push-prompt-answered:'),
  // Escritos a mao ou que o servidor nao guarda (modelos, vistas de filtros,
  // opcoes de importacao do horario, melhor streak, metas de nota, ordem das
  // Areas e o estado local dos quizzes).
  ...Object.values(ACCOUNT_SCOPED_KEYS).map((key) => perUser(`${key}:`)),
];

// Entrada que manda numa chave: a exata ganha a um prefixo, e entre prefixos
// ganha o mais comprido ('pm-daily-digest-enabled' nao e um dia do resumo).
export function findStorageEntry(key: string, session = false): StorageEntry | undefined {
  let best: StorageEntry | undefined;
  for (const entry of STORAGE_REGISTRY) {
    if (Boolean(entry.session) !== session) continue;
    if (!entry.prefix) {
      if (entry.key === key) return entry;
    } else if (key.startsWith(entry.key) && (!best || entry.key.length > best.key.length)) {
      best = entry;
    }
  }
  return best;
}

// Best-effort: sem armazenamento (modo privado) nao ha nada a limpar.
function removeWhere(session: boolean, shouldRemove: (key: string) => boolean): void {
  try {
    const storage = session ? sessionStorage : localStorage;
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key !== null) keys.push(key);
    }
    for (const key of keys) if (shouldRemove(key)) storage.removeItem(key);
  } catch {
    // Armazenamento bloqueado.
  }
}

function removeCategories(categories: readonly StorageCategory[]): void {
  for (const session of [false, true]) {
    removeWhere(session, (key) => {
      const category = findStorageEntry(key, session)?.category;
      return category !== undefined && categories.includes(category);
    });
  }
}

// Logout: tira o que e de quem estava com sessao e se pode perder.
export function clearUserStorage(): void {
  removeCategories(['userCache']);
}

// A conta muda ou desaparece: tambem o trabalho a meio dela.
function clearPreviousAccountStorage(): void {
  removeCategories(['userCache', 'userDraft']);
}

// Conta apagada: tambem as chaves com o id dela. As userKept ficam, porque nao
// estao separadas por conta e podem ser de outra pessoa neste browser.
export function removeAccountStorage(userId: string): void {
  clearPreviousAccountStorage();
  removeWhere(false, (key) => {
    const entry = findStorageEntry(key);
    return entry?.category === 'perUser' && key === `${entry.key}${userId}`;
  });
}

// Chave da conta com sessao neste browser. Sem dono conhecido (ou sem
// armazenamento) fica a chave sem id, que a primeira conta adota.
export function accountStorageKey(base: string): string {
  try {
    const owner = localStorage.getItem(STORAGE_OWNER_KEY);
    return owner === null ? base : `${base}:${owner}`;
  } catch {
    return base;
  }
}

// Move os dados sem id para a conta indicada. Nunca apaga o que nao conseguiu
// copiar, nem escreve por cima do que a conta ja tem.
function adoptUnscopedKeys(userId: string): void {
  for (const base of Object.values(ACCOUNT_SCOPED_KEYS)) {
    try {
      const value = localStorage.getItem(base);
      const target = `${base}:${userId}`;
      if (value === null || localStorage.getItem(target) !== null) continue;
      localStorage.setItem(target, value);
      localStorage.removeItem(base);
    } catch {
      // Armazenamento cheio ou bloqueado: os dados antigos ficam onde estao.
    }
  }
}

// Entrou uma conta. Se for diferente da anterior (sessao que expirou sem
// logout, por exemplo) limpa o que ficou; a mesma conta mantem os rascunhos.
export function claimUserStorage(userId: string): void {
  try {
    const owner = localStorage.getItem(STORAGE_OWNER_KEY);
    // Antes de trocar de dono: os dados antigos sao de quem usou o browser.
    adoptUnscopedKeys(owner ?? userId);
    if (owner === userId) return;
    if (owner !== null) clearPreviousAccountStorage();
    localStorage.setItem(STORAGE_OWNER_KEY, userId);
  } catch {
    // Armazenamento bloqueado.
  }
}
