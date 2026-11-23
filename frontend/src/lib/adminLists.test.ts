import { describe, expect, it } from 'vitest';
import { blockedSources, filterByCategory, filterUsers, pageSlice, sortUsers } from './adminLists';
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
  it('sorts by name ignoring case and by joined date', () => {
    expect(sortUsers(users, 'name', 'asc').map((u) => u.id)).toEqual(['a', 'b', 'c']);
    expect(sortUsers(users, 'joined', 'desc').map((u) => u.id)).toEqual(['a', 'b', 'c']);
  });
  it('pageSlice clamps skip', () => {
    const items = [1, 2, 3, 4, 5];
    expect(pageSlice(items, 2, 2)).toEqual({ rows: [3, 4], skip: 2 });
    expect(pageSlice(items, 99, 2)).toEqual({ rows: [5], skip: 4 });
    expect(pageSlice([], 5, 2)).toEqual({ rows: [], skip: 0 });
  });
  it('filters by category', () => {
    const items = [{ category: 'BUG' }, { category: 'IDEA' }];
    expect(filterByCategory(items, 'BUG')).toHaveLength(1);
    expect(filterByCategory(items, 'all')).toHaveLength(2);
  });
  it('blockedSources dedupes', () => {
    expect(
      blockedSources([
        { sourceBlocked: true, updatedByIpHash: 'h1' },
        { sourceBlocked: true, updatedByIpHash: 'h1' },
        { sourceBlocked: false, updatedByIpHash: 'h2' },
        { sourceBlocked: true, updatedByIpHash: null },
      ]),
    ).toEqual(['h1']);
  });
});
