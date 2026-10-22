import { socialTabPath } from '../../lib/appLinks';

export interface NavItem {
  to: string;
  labelKey: string;
}

// Uma so lista por menu: a barra (NavLinks), o painel mobile (MobileMenu),
// o menu da conta (UserMenu) e o de admin liam cada um a sua copia, e o
// mobile ja tinha ficado sem Weekly review e Changelog.
export const MAIN_NAV: NavItem[] = [
  { to: '/dashboard', labelKey: 'nav.dashboard' },
  { to: '/tasks', labelKey: 'nav.tasks' },
  { to: '/focus', labelKey: 'nav.focus' },
  { to: '/schedule', labelKey: 'nav.schedule' },
  { to: '/notebook', labelKey: 'nav.notebook' },
  { to: '/areas', labelKey: 'nav.areas' },
];

export const ACCOUNT_NAV: NavItem[] = [
  { to: '/profile', labelKey: 'nav.profile' },
  { to: '/developer', labelKey: 'nav.developer' },
  { to: '/agent', labelKey: 'nav.agent' },
  { to: '/review', labelKey: 'nav.review' },
  { to: '/wellbeing', labelKey: 'nav.wellbeing' },
  { to: '/changelog', labelKey: 'nav.changelog' },
];

export const ADMIN_NAV: NavItem[] = [
  { to: '/users', labelKey: 'nav.admin.users' },
  { to: '/task-types', labelKey: 'nav.admin.taskTypes' },
  { to: '/security', labelKey: 'nav.admin.security' },
  { to: '/appeals', labelKey: 'nav.admin.appeals' },
  { to: '/feedback', labelKey: 'nav.admin.feedback' },
  { to: '/friend-code-requests', labelKey: 'nav.admin.friendCodes' },
];

export const SOCIAL_PATH = '/social';

// Com pedidos por responder, o link do Social abre logo o separador deles.
export function socialNavTarget(pending: number): string {
  return pending > 0 ? socialTabPath('requests') : SOCIAL_PATH;
}

// Sub-paginas (ex: /social/friends/...) tambem marcam o link.
export function isNavActive(currentPath: string, to: string): boolean {
  return currentPath === to || currentPath.startsWith(`${to}/`);
}
