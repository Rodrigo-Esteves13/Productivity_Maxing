import { socialTabPath } from '../../lib/appLinks';
import { pagesInSection, type SiteSection } from '../../lib/siteMap';

export interface NavItem {
  to: string;
  labelKey: string;
}

// Uma so lista por menu: a barra (NavLinks), o painel mobile (MobileMenu),
// o menu da conta (UserMenu) e o de admin liam cada um a sua copia, e o
// mobile ja tinha ficado sem Weekly review e Changelog. O painel mobile e o
// menu da conta agrupam por secao a partir do mapa (navGroups).
export const MAIN_NAV: NavItem[] = [
  { to: '/dashboard', labelKey: 'nav.dashboard' },
  { to: '/tasks', labelKey: 'nav.tasks' },
  { to: '/focus', labelKey: 'nav.focus' },
  { to: '/schedule', labelKey: 'nav.schedule' },
  { to: '/notebook', labelKey: 'nav.notebook' },
  { to: '/classes', labelKey: 'nav.turmas' },
  { to: '/areas', labelKey: 'nav.areas' },
];

export const SOCIAL_PATH = '/social';

export interface NavGroup {
  section: SiteSection;
  items: NavItem[];
}

// Secoes do mapa que entram nos menus: o legal vive no rodape e o admin
// tem o seu proprio menu.
const MENU_SECTIONS: SiteSection[] = ['study', 'together', 'life', 'account', 'help'];

// Paginas que a barra de cima ja mostra (no menu da conta seriam repetidas).
export const BAR_PATHS: ReadonlySet<string> = new Set([...MAIN_NAV.map((item) => item.to), SOCIAL_PATH]);

/**
 * As paginas por secao, pela mesma ordem do trilho e do rodape
 * (lib/siteMap.ts). O painel mobile mostra tudo; o menu da conta tira o que
 * ja esta na barra.
 */
export function navGroups(exclude: ReadonlySet<string> = new Set()): NavGroup[] {
  return MENU_SECTIONS.map((section) => ({
    section,
    items: pagesInSection(section, false)
      .filter((page) => !exclude.has(page.path))
      .map((page) => ({ to: page.path, labelKey: page.labelKey })),
  })).filter((group) => group.items.length > 0);
}

export const ADMIN_NAV: NavItem[] = [
  { to: '/users', labelKey: 'nav.admin.users' },
  { to: '/task-types', labelKey: 'nav.admin.taskTypes' },
  { to: '/security', labelKey: 'nav.admin.security' },
  { to: '/appeals', labelKey: 'nav.admin.appeals' },
  { to: '/feedback', labelKey: 'nav.admin.feedback' },
  { to: '/friend-code-requests', labelKey: 'nav.admin.friendCodes' },
  { to: '/pads-admin', labelKey: 'nav.admin.pads' },
];

// Com pedidos por responder, o link do Social abre logo o separador deles.
export function socialNavTarget(pending: number): string {
  return pending > 0 ? socialTabPath('requests') : SOCIAL_PATH;
}

// Sub-paginas (ex: /social/friends/...) tambem marcam o link.
export function isNavActive(currentPath: string, to: string): boolean {
  return currentPath === to || currentPath.startsWith(`${to}/`);
}
