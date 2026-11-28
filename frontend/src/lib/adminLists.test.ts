import { describe, expect, it } from 'vitest';
import {
  USERS_PAGE_SIZE,
  USER_SEARCH_MAX_LENGTH,
  appendById,
  filterUsers,
  usersPageQuery,
} from './adminLists';
import type { User } from '../types/models';

const mk = (id: string, over: Partial<User>): User =>
  ({ id, email: `${id}@x.com`, role: 'USER', name: null, avatarUrl: null, createdAt: '2024-01-01T00:00:00Z', hasPassword: true, ...over }) as User;

const users = [
  mk('b', { name: 'Bruno', createdAt: '2024-03-01T00:00:00Z', status: 'BANNED' }),
  mk('a', { name: 'ana', role: 'ADMIN', createdAt: '2024-05-01T00:00:00Z', status: 'ACTIVE' }),
  mk('c', { name: null, createdAt: '2024-01-01T00:00:00Z' }),
];

describe('adminLists', () => {
  it('filters by role and status (missing status counts as ACTIVE)', () => {
    expect(filterUsers(users, { role: 'ADMIN', status: 'all' }).map((u) => u.id)).toEqual(['a']);
    expect(filterUsers(users, { role: 'all', status: 'ACTIVE' }).map((u) => u.id)).toEqual(['a', 'c']);
    expect(filterUsers(users, { role: 'all', status: 'all' })).toHaveLength(3);
  });
  it('builds the server query without empty or unknown params', () => {
    const base = { search: '  ', role: 'all', status: 'all', sortKey: 'name', direction: 'asc' } as const;
    expect(usersPageQuery(base)).toEqual({ sort: 'name', order: 'asc', limit: USERS_PAGE_SIZE });
    expect(
      usersPageQuery({ search: ' ana ', role: 'ADMIN', status: 'BANNED', sortKey: 'joined', direction: 'asc' }),
    ).toEqual({ q: 'ana', role: 'ADMIN', status: 'BANNED', sort: 'joined', order: 'asc', limit: USERS_PAGE_SIZE });
    expect(usersPageQuery({ ...base, search: 'a'.repeat(USER_SEARCH_MAX_LENGTH + 5) }).q).toHaveLength(
      USER_SEARCH_MAX_LENGTH,
    );
  });
  it('appends the next page without repeating ids', () => {
    expect(appendById([{ id: 'a' }], [{ id: 'a' }, { id: 'b' }])).toEqual([{ id: 'a' }, { id: 'b' }]);
  });
});
