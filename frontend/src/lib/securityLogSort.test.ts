import { describe, expect, it } from 'vitest';
import type { SecurityLog } from '../types/models';
import { nextSecurityLogSort, sortSecurityLogs } from './securityLogSort';

function log(id: string, over: Partial<SecurityLog>): SecurityLog {
  return {
    id,
    type: 'RATE_LIMIT_EXCEEDED',
    ip: '1.1.1.1',
    method: 'GET',
    path: '/a',
    userAgent: null,
    count: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    userId: null,
    user: null,
    ...over,
  };
}

describe('sortSecurityLogs', () => {
  const logs = [
    log('a', { ip: '10.0.0.2', createdAt: '2026-01-02T00:00:00.000Z' }),
    log('b', { ip: '10.0.0.10', createdAt: '2026-01-03T00:00:00.000Z' }),
    log('c', { ip: '9.0.0.1', createdAt: '2026-01-01T00:00:00.000Z' }),
  ];

  it('sorts by ip numerically-aware ascending', () => {
    expect(sortSecurityLogs(logs, { key: 'ip', direction: 'asc' }).map((l) => l.id)).toEqual(['c', 'a', 'b']);
  });

  it('sorts by date descending without mutating the input', () => {
    const sorted = sortSecurityLogs(logs, { key: 'createdAt', direction: 'desc' });
    expect(sorted.map((l) => l.id)).toEqual(['b', 'a', 'c']);
    expect(logs.map((l) => l.id)).toEqual(['a', 'b', 'c']);
  });

  it('puts anonymous users first when sorting by user ascending', () => {
    const mixed = [
      log('x', { user: { id: '1', email: 'z@z.com', name: null } }),
      log('y', { user: null }),
    ];
    expect(sortSecurityLogs(mixed, { key: 'user', direction: 'asc' }).map((l) => l.id)).toEqual(['y', 'x']);
  });
});

describe('nextSecurityLogSort', () => {
  it('toggles the active column', () => {
    expect(nextSecurityLogSort({ key: 'ip', direction: 'asc' }, 'ip')).toEqual({ key: 'ip', direction: 'desc' });
  });

  it('starts a new column ascending, date descending', () => {
    expect(nextSecurityLogSort({ key: 'ip', direction: 'desc' }, 'path')).toEqual({ key: 'path', direction: 'asc' });
    expect(nextSecurityLogSort({ key: 'ip', direction: 'asc' }, 'createdAt')).toEqual({
      key: 'createdAt',
      direction: 'desc',
    });
  });
});
