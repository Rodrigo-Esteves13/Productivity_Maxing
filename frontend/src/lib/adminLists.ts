import type { Role, User, UserStatus } from '../types/models';
import type { SortDirection } from './sortDirection';

// Logica pura das listas de admin (utilizadores, feedback): filtrar, ordenar
// e paginar no cliente. Sem React para ser testavel.

export const ALL_FILTER = 'all';
export type AllOr<T extends string> = T | typeof ALL_FILTER;

export type UserSortKey = 'name' | 'joined';
export const USER_SORT_KEYS: UserSortKey[] = ['name', 'joined'];
export const USERS_PAGE_SIZE = 20;

export const USER_ROLES: Role[] = ['ADMIN', 'USER'];
export const USER_STATUSES: UserStatus[] = ['ACTIVE', 'SUSPENDED', 'BANNED'];

export interface UserFilters {
  role: AllOr<Role>;
  status: AllOr<UserStatus>;
}

export function filterUsers(users: readonly User[], filters: UserFilters): User[] {
  return users.filter(
    (u) =>
      (filters.role === ALL_FILTER || u.role === filters.role) &&
      (filters.status === ALL_FILTER || (u.status ?? 'ACTIVE') === filters.status),
  );
}

const USER_COMPARE: Record<UserSortKey, (a: User, b: User) => number> = {
  name: (a, b) => (a.name || a.email).localeCompare(b.name || b.email, undefined, { sensitivity: 'base' }),
  joined: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
};

export function sortUsers(users: readonly User[], key: UserSortKey, direction: SortDirection): User[] {
  const sign = direction === 'asc' ? 1 : -1;
  return [...users].sort((a, b) => sign * USER_COMPARE[key](a, b));
}

/** Fatia `skip..skip+size`; skip fora do intervalo recua para a ultima pagina. */
export function pageSlice<T>(items: readonly T[], skip: number, size: number): { rows: T[]; skip: number } {
  const lastSkip = Math.max(0, Math.floor((items.length - 1) / size) * size);
  const safeSkip = Math.min(Math.max(0, skip), lastSkip);
  return { rows: items.slice(safeSkip, safeSkip + size), skip: safeSkip };
}

/** Filtro por categoria de feedback (ou todas). */
export function filterByCategory<T extends { category: string }>(items: readonly T[], category: string): T[] {
  return category === ALL_FILTER ? items.slice() : items.filter((i) => i.category === category);
}

/** Hashes de origem bloqueada, sem repetidos, pela ordem em que aparecem. */
export function blockedSources(pads: ReadonlyArray<{ sourceBlocked: boolean; updatedByIpHash: string | null }>): string[] {
  const seen = new Set<string>();
  for (const pad of pads) {
    if (pad.sourceBlocked && pad.updatedByIpHash) seen.add(pad.updatedByIpHash);
  }
  return [...seen];
}
