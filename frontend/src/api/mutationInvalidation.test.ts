import { describe, expect, it } from 'vitest';
import { isCacheNeutralMutation, mutationPath } from './mutationInvalidation';

describe('mutationPath', () => {
  it.each([
    ['/tasks/1?x=2', '/tasks/1'],
    ['tasks', '/tasks'],
    ['https://api.test/areas/a#frag', '/areas/a'],
    [undefined, '/'],
  ])('%s becomes %s', (url, path) => {
    expect(mutationPath(url)).toBe(path);
  });
});

describe('isCacheNeutralMutation', () => {
  it.each(['/telemetry/web-vitals', '/finance/accounts', '/notebook/entries/1', '/study-sessions/s1/heartbeat', '/auth/refresh', '/auth/2fa/setup'])(
    '%s leaves the cache alone',
    (path) => {
      expect(isCacheNeutralMutation(path)).toBe(true);
    },
  );

  it.each([
    '/tasks',
    '/tasks/import',
    '/areas/a1',
    '/task-packs/code/import',
    '/grade-components/g1',
    '/study-sessions/start',
    '/study-sessions/s1',
    '/auth/login',
    '/auth/2fa/login',
    '/auth/logout',
    '/auth/me',
    '/financeiro',
    '/new-route-nobody-listed',
  ])('%s invalidates the cache', (path) => {
    expect(isCacheNeutralMutation(path)).toBe(false);
  });
});
