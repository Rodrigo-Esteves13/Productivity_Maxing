import type { Role, User, UserStatus } from '../types/models';
import type { SortDirection } from './sortDirection';

// Logica pura das listas de admin (utilizadores, feedback): filtros e pedido
// da pagina. Sem React para ser testavel.

export const ALL_FILTER = 'all';
export type AllOr<T extends string> = T | typeof ALL_FILTER;

export type UserSortKey = 'name' | 'joined';
export const USER_SORT_KEYS: UserSortKey[] = ['name', 'joined'];
export const USERS_PAGE_SIZE = 20;
// Tem de acompanhar USER_SEARCH_MAX_LENGTH do backend (400 acima disto).
export const USER_SEARCH_MAX_LENGTH = 100;
export const USER_SEARCH_DEBOUNCE_MS = 300;

export const USER_ROLES: Role[] = ['ADMIN', 'USER'];
export const USER_STATUSES: UserStatus[] = ['ACTIVE', 'SUSPENDED', 'BANNED'];

export interface UserFilters {
  role: AllOr<Role>;
  status: AllOr<UserStatus>;
}

/** Parametros de GET /users (o backend recusa quaisquer outros). */
export interface UsersPageQuery {
  q?: string;
  role?: Role;
  status?: UserStatus;
  sort: UserSortKey;
  order: SortDirection;
  limit: number;
  cursor?: string;
}

export interface UsersListCriteria extends UserFilters {
  search: string;
  sortKey: UserSortKey;
  direction: SortDirection;
}

/** Pedido da 1a pagina. */
export function usersPageQuery({ search, role, status, sortKey, direction }: UsersListCriteria): UsersPageQuery {
  const q = search.trim().slice(0, USER_SEARCH_MAX_LENGTH).trim();
  return {
    ...(q ? { q } : {}),
    ...(role !== ALL_FILTER ? { role } : {}),
    ...(status !== ALL_FILTER ? { status } : {}),
    sort: sortKey,
    order: direction,
    limit: USERS_PAGE_SIZE,
  };
}

/** Junta a pagina seguinte sem repetir ids. */
export function appendById<T extends { id: string }>(current: readonly T[], next: readonly T[]): T[] {
  const seen = new Set(current.map((item) => item.id));
  return [...current, ...next.filter((item) => !seen.has(item.id))];
}

export function filterUsers(users: readonly User[], filters: UserFilters): User[] {
  return users.filter(
    (u) =>
      (filters.role === ALL_FILTER || u.role === filters.role) &&
      (filters.status === ALL_FILTER || (u.status ?? 'ACTIVE') === filters.status),
  );
}
