import { socialTabPath } from './appLinks';

// Mapa da app num so sitio: a que secao pertence cada pagina, de que pagina
// e "filha" (para o trilho) e com que outras paginas trabalha. O PageLayout
// desenha o trilho e os "Works with" a partir daqui, e o Breadcrumbs das
// sub-paginas (turma, perfil de amigo...) poe a secao a frente. Pagina nova
// = uma linha aqui.

export type SiteSection = 'study' | 'together' | 'life' | 'account' | 'help' | 'legal' | 'admin';

export interface SiteLink {
  to: string;
  /** Texto do que se faz la (chave i18n), nao so o nome da pagina. */
  labelKey: string;
}

export interface SitePage {
  path: string;
  labelKey: string;
  section: SiteSection;
  /** Pagina acima desta no trilho (ex: Report card fica debaixo de Areas). */
  parent?: string;
  related?: SiteLink[];
  /** So para admins (o menu da secao esconde-a aos outros). */
  adminOnly?: boolean;
  /** Separadores em ?tab=: o ativo entra no fim do trilho. */
  tabs?: Record<string, string>;
}

export const SECTION_LABEL_KEY: Record<SiteSection, string> = {
  study: 'map.section.study',
  together: 'map.section.together',
  life: 'map.section.life',
  account: 'map.section.account',
  help: 'map.section.help',
  legal: 'map.section.legal',
  admin: 'map.section.admin',
};

export const SITE_PAGES: SitePage[] = [
  // Estudo: o dia a dia academico.
  {
    path: '/dashboard',
    labelKey: 'nav.dashboard',
    section: 'study',
    related: [
      { to: '/tasks', labelKey: 'related.dashboard.tasks' },
      { to: '/schedule', labelKey: 'related.dashboard.schedule' },
      { to: '/focus', labelKey: 'related.dashboard.focus' },
      { to: '/review', labelKey: 'related.dashboard.review' },
    ],
  },
  {
    path: '/tasks',
    labelKey: 'nav.tasks',
    section: 'study',
    related: [
      { to: '/classes', labelKey: 'related.tasks.classes' },
      { to: '/focus', labelKey: 'related.tasks.focus' },
      { to: '/schedule', labelKey: 'related.tasks.schedule' },
      { to: '/report-card', labelKey: 'related.tasks.reportCard' },
      { to: '/task-packs', labelKey: 'related.tasks.packs' },
    ],
  },
  {
    path: '/focus',
    labelKey: 'nav.focus',
    section: 'study',
    related: [
      { to: '/tasks', labelKey: 'related.focus.tasks' },
      { to: '/review', labelKey: 'related.focus.review' },
    ],
  },
  {
    path: '/schedule',
    labelKey: 'nav.schedule',
    section: 'study',
    related: [
      { to: '/classes', labelKey: 'related.schedule.classes' },
      { to: '/notebook', labelKey: 'related.schedule.notebook' },
      { to: '/tasks', labelKey: 'related.schedule.tasks' },
    ],
  },
  {
    path: '/notebook',
    labelKey: 'nav.notebook',
    section: 'study',
    related: [
      { to: '/schedule', labelKey: 'related.notebook.schedule' },
      { to: '/classes', labelKey: 'related.notebook.classes' },
      { to: socialTabPath('friends'), labelKey: 'related.notebook.social' },
      { to: '/areas', labelKey: 'related.notebook.areas' },
    ],
  },
  {
    path: '/areas',
    labelKey: 'nav.areas',
    section: 'study',
    related: [
      { to: '/report-card', labelKey: 'related.areas.reportCard' },
      { to: '/notebook', labelKey: 'related.areas.notebook' },
      { to: '/tasks', labelKey: 'related.areas.tasks' },
    ],
  },
  {
    path: '/report-card',
    labelKey: 'reportCard.title',
    section: 'study',
    parent: '/areas',
    related: [
      { to: '/classes', labelKey: 'related.reportCard.classes' },
      { to: '/tasks', labelKey: 'related.reportCard.tasks' },
    ],
  },
  {
    path: '/review',
    labelKey: 'nav.review',
    section: 'study',
    parent: '/dashboard',
    related: [
      { to: '/focus', labelKey: 'related.review.focus' },
      { to: '/wellbeing', labelKey: 'related.review.wellbeing' },
      { to: '/tasks', labelKey: 'related.review.tasks' },
    ],
  },

  // Com os outros: turma, amigos, partilhas.
  {
    path: '/classes',
    labelKey: 'nav.turmas',
    section: 'together',
    related: [
      { to: '/schedule', labelKey: 'related.turmas.schedule' },
      { to: '/notebook', labelKey: 'related.turmas.notebook' },
      { to: socialTabPath('friends'), labelKey: 'related.turmas.social' },
      { to: '/report-card', labelKey: 'related.turmas.reportCard' },
    ],
  },
  {
    path: '/social',
    labelKey: 'nav.social',
    section: 'together',
    tabs: {
      requests: 'social.tab.requests',
      friends: 'social.tab.friends',
      shared: 'social.tab.shared',
      mine: 'social.tab.mine',
    },
    related: [
      { to: '/classes', labelKey: 'related.social.classes' },
      { to: '/notebook', labelKey: 'related.social.notebook' },
      { to: '/task-packs', labelKey: 'related.social.packs' },
    ],
  },
  {
    path: '/task-packs',
    labelKey: 'nav.taskPacks',
    section: 'together',
    parent: '/tasks',
    related: [
      { to: '/classes', labelKey: 'related.packs.classes' },
      { to: '/tasks', labelKey: 'related.packs.tasks' },
    ],
  },
  {
    path: '/pad',
    labelKey: 'nav.pads',
    section: 'together',
    related: [{ to: '/notebook', labelKey: 'related.pad.notebook' }],
  },

  // Vida fora das aulas.
  {
    path: '/wellbeing',
    labelKey: 'nav.wellbeing',
    section: 'life',
    related: [
      { to: '/review', labelKey: 'related.wellbeing.review' },
      { to: '/notes', labelKey: 'related.wellbeing.notes' },
    ],
  },
  {
    path: '/notes',
    labelKey: 'notes.title',
    section: 'life',
    related: [
      { to: '/tasks', labelKey: 'related.notes.tasks' },
      { to: '/wellbeing', labelKey: 'related.notes.wellbeing' },
    ],
  },
  {
    path: '/finance',
    labelKey: 'finance.title',
    section: 'life',
    related: [{ to: '/schedule', labelKey: 'related.finance.schedule' }],
  },

  // Conta.
  {
    path: '/profile',
    labelKey: 'nav.profile',
    section: 'account',
    related: [
      { to: '/agent', labelKey: 'related.profile.agent' },
      { to: '/wellbeing', labelKey: 'related.profile.wellbeing' },
    ],
  },
  {
    path: '/agent',
    labelKey: 'nav.agent',
    section: 'account',
    related: [{ to: '/focus', labelKey: 'related.agent.focus' }],
  },
  {
    path: '/developer',
    labelKey: 'nav.developer',
    section: 'account',
    related: [
      { to: '/agent', labelKey: 'related.profile.agent' },
      { to: '/changelog', labelKey: 'related.feedback.changelog' },
    ],
  },

  // Ajuda.
  {
    path: '/changelog',
    labelKey: 'nav.changelog',
    section: 'help',
    related: [{ to: '/my-feedback', labelKey: 'related.changelog.feedback' }],
  },
  {
    path: '/my-feedback',
    labelKey: 'feedback.mine.title',
    section: 'help',
    related: [{ to: '/changelog', labelKey: 'related.feedback.changelog' }],
  },

  // Legal.
  { path: '/privacy', labelKey: 'footer.privacy', section: 'legal' },
  { path: '/terms', labelKey: 'footer.terms', section: 'legal' },
  { path: '/eula', labelKey: 'footer.eula', section: 'legal' },
  { path: '/dmca', labelKey: 'footer.dmca', section: 'legal' },

  // Admin.
  { path: '/users', labelKey: 'nav.admin.users', section: 'admin', adminOnly: true },
  { path: '/task-types', labelKey: 'nav.admin.taskTypes', section: 'admin', adminOnly: true },
  { path: '/security', labelKey: 'nav.admin.security', section: 'admin', adminOnly: true },
  { path: '/appeals', labelKey: 'nav.admin.appeals', section: 'admin', adminOnly: true },
  { path: '/feedback', labelKey: 'nav.admin.feedback', section: 'admin', adminOnly: true },
  { path: '/friend-code-requests', labelKey: 'nav.admin.friendCodes', section: 'admin', adminOnly: true },
  { path: '/pads-admin', labelKey: 'nav.admin.pads', section: 'admin', adminOnly: true },
];

const BY_PATH = new Map(SITE_PAGES.map((page) => [page.path, page]));

/** A pagina exata deste caminho (sem query nem ancora). */
export function sitePage(path: string): SitePage | undefined {
  return BY_PATH.get(stripQuery(path));
}

// Sem ?query nem #ancora (a paleta abre /wellbeing#blood, por exemplo).
function stripQuery(path: string): string {
  return path.split(/[?#]/)[0];
}

/**
 * A pagina do mapa a que um caminho pertence: a exata, ou a mais longa que
 * seja prefixo (/classes/abc -> /classes, /social/friends/x -> /social).
 */
export function owningPage(path: string): SitePage | undefined {
  const clean = stripQuery(path);
  const exact = BY_PATH.get(clean);
  if (exact) return exact;
  let best: SitePage | undefined;
  for (const page of SITE_PAGES) {
    if (clean.startsWith(`${page.path}/`) && (!best || page.path.length > best.path.length)) best = page;
  }
  return best;
}

export function pagesInSection(section: SiteSection, isAdmin: boolean): SitePage[] {
  return SITE_PAGES.filter((page) => page.section === section && (isAdmin || !page.adminOnly));
}

/** Cadeia de paginas-pai, da mais alta ate a propria (ex: Areas, Report card). */
export function pageChain(page: SitePage): SitePage[] {
  const chain: SitePage[] = [page];
  let current = page;
  while (current.parent) {
    const parent = BY_PATH.get(current.parent);
    if (!parent || chain.includes(parent)) break;
    chain.unshift(parent);
    current = parent;
  }
  return chain;
}
