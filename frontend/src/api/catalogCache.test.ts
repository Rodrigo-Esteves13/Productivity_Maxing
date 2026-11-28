import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

// Cache de tasks, areas e metadados atraves do cliente HTTP real: so a rede
// e falsa. Cobre frescura, invalidacao por escrita, corridas, copias, o
// "ultimo conhecido" das conquistas (F-18) e a limpeza num 401.

type Handler = (config: InternalAxiosRequestConfig) => Promise<AxiosResponse>;

function ok(config: InternalAxiosRequestConfig, data: unknown): Promise<AxiosResponse> {
  return Promise.resolve({ data, status: 200, statusText: 'OK', headers: {}, config });
}

function fail(config: InternalAxiosRequestConfig, status: number): Promise<AxiosResponse> {
  return Promise.reject(
    new AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_REQUEST', config, null, {
      status,
      statusText: 'Error',
      headers: {},
      config: { ...config, headers: new AxiosHeaders() },
      data: {},
    }),
  );
}

const task = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  progressStatus: 'NOT_STARTED',
  completedAt: null,
  type: 'HOMEWORK',
  ...extra,
});

const page = (items: unknown[]) => ({ items, nextCursor: null });

async function setup() {
  const { default: api } = await import('./client');
  const { invalidateOnWrite } = await import('./mutationInvalidation');
  const service = {
    ...(await import('./tasksService')),
    ...(await import('./areasService')),
    ...(await import('./metadataService')),
  };
  const cache = await import('./catalogCache');
  const { resetQueryCacheForTests } = await import('./queryCache');
  resetQueryCacheForTests();
  const requests: string[] = [];
  let handler: Handler = (config) => ok(config, {});
  api.defaults.adapter = invalidateOnWrite((config) => {
    requests.push(`${(config.method ?? 'get').toUpperCase()} ${config.url}`);
    return handler(config);
  });
  const gets = (url: string) => requests.filter((r) => r === `GET ${url}`).length;
  return {
    api,
    service,
    cache,
    gets,
    requests,
    setHandler: (next: Handler) => {
      handler = next;
    },
  };
}

describe('catalog cache through the API client', () => {
  const location = { pathname: '/tasks', href: 'https://app.test/tasks', reload: vi.fn() };

  beforeEach(() => {
    vi.resetModules();
    location.pathname = '/tasks';
    location.href = 'https://app.test/tasks';
    vi.stubGlobal('window', { location, dispatchEvent: vi.fn() });
    vi.stubGlobal('navigator', {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('downloads the task list once while it is fresh', async () => {
    const { service, gets, setHandler } = await setup();
    setHandler((config) => ok(config, page([task('t1')])));
    await service.getUserTasks();
    await service.getUserTasks();
    expect(gets('/tasks')).toBe(1);
  });

  it('keeps periods, hidden areas and the catalog apart', async () => {
    const { service, gets, setHandler } = await setup();
    setHandler((config) => {
      if (config.url === '/tasks/meta') return ok(config, { taskTypes: [] });
      return ok(config, config.url === '/areas' ? [] : page([]));
    });
    await service.getUserTasks();
    await service.getUserTasks('p2');
    await service.getUserAreas();
    await service.getUserAreas(undefined, true);
    await service.getTaskMetadata();
    await service.getTaskMetadata();
    expect(gets('/tasks')).toBe(2);
    expect(gets('/areas')).toBe(2);
    expect(gets('/tasks/meta')).toBe(1);
  });

  it('gives each caller its own copy of every task', async () => {
    const { service, setHandler } = await setup();
    setHandler((config) => ok(config, page([task('t1')])));
    const first = await service.getUserTasks();
    first[0].title = 'changed by a caller';
    first.pop();
    const second = await service.getUserTasks();
    expect(second).toHaveLength(1);
    expect(second[0].title).toBeUndefined();
  });

  it('never serves the old list after a write', async () => {
    const { service, gets, setHandler } = await setup();
    let list = [task('t1')];
    setHandler((config) => {
      if (config.method === 'post') {
        list = [...list, task('t2')];
        return ok(config, task('t2'));
      }
      return ok(config, page(list));
    });
    await service.getUserTasks();
    await service.createTask({ title: 'new' } as never);
    const after = await service.getUserTasks();
    expect(after.map((t) => t.id)).toEqual(['t1', 't2']);
    expect(gets('/tasks')).toBe(2);
  });

  it('invalidates areas and the catalog on any non-neutral write', async () => {
    const { api, service, gets, setHandler } = await setup();
    setHandler((config) => ok(config, config.url === '/tasks/meta' ? { taskTypes: [] } : []));
    await service.getUserAreas();
    await service.getTaskMetadata();
    await api.post('/turmas/x/deadlines', {});
    await service.getUserAreas();
    await service.getTaskMetadata();
    expect(gets('/areas')).toBe(2);
    expect(gets('/tasks/meta')).toBe(2);
  });

  it('keeps the cache on neutral writes and on reads', async () => {
    const { api, service, gets, setHandler } = await setup();
    setHandler((config) => ok(config, []));
    await service.getUserAreas();
    await api.post('/telemetry/web-vitals', {});
    await api.post('/study-sessions/s1/heartbeat', {});
    await api.get('/finance');
    await service.getUserAreas();
    expect(gets('/areas')).toBe(1);
  });

  it('invalidates even when the write fails', async () => {
    const { api, service, gets, setHandler } = await setup();
    setHandler((config) => (config.method === 'get' ? ok(config, []) : fail(config, 400)));
    await service.getUserAreas();
    await expect(api.patch('/areas/a1', {})).rejects.toBeInstanceOf(AxiosError);
    await service.getUserAreas();
    expect(gets('/areas')).toBe(2);
  });

  it('does not let a read that started before a write fill the cache', async () => {
    const { service, gets, setHandler } = await setup();
    let releaseOldRead: () => void = () => undefined;
    let reads = 0;
    setHandler((config) => {
      if (config.method !== 'get') return ok(config, task('t2'));
      reads += 1;
      if (reads === 1) {
        return new Promise((resolve) => {
          releaseOldRead = () => resolve({ data: page([task('t1')]), status: 200, statusText: 'OK', headers: {}, config });
        });
      }
      return ok(config, page([task('t1'), task('t2')]));
    });
    const oldRead = service.getUserTasks();
    await service.createTask({ title: 'new' } as never);
    releaseOldRead();
    await expect(oldRead).resolves.toHaveLength(1);
    await expect(service.getUserTasks()).resolves.toHaveLength(2);
    expect(gets('/tasks')).toBe(2);
  });

  it('respects the caller signal without cancelling the other readers', async () => {
    const { service, setHandler } = await setup();
    let release: (() => void) | null = null;
    let networkSignal: AbortSignal | undefined;
    setHandler(
      (config) =>
        new Promise((resolve) => {
          networkSignal = config.signal as AbortSignal | undefined;
          release = () => resolve({ data: page([task('t1')]), status: 200, statusText: 'OK', headers: {}, config });
        }),
    );
    const controller = new AbortController();
    const aborted = service.getUserTasks(undefined, controller.signal);
    const kept = service.getUserTasks();
    await vi.waitFor(() => expect(release).not.toBeNull());
    controller.abort();
    expect(networkSignal?.aborted).toBe(false);
    release!();
    await expect(aborted).rejects.toMatchObject({ name: 'CanceledError' });
    await expect(kept).resolves.toHaveLength(1);
  });

  describe('known tasks for badges (F-18)', () => {
    it('applies a completion without downloading the list again', async () => {
      const { service, cache, gets, setHandler } = await setup();
      setHandler((config) => {
        if (config.method === 'patch') {
          return ok(config, { ...task('t1', { progressStatus: 'COMPLETED', completedAt: '2026-11-25T10:00:00Z' }), spawnedTasks: [task('t3')] });
        }
        return ok(config, page([task('t1'), task('t2')]));
      });
      await service.getUserTasks();
      await service.updateTask('t1', { progressStatus: 'COMPLETED' } as never);
      const known = cache.peekKnownTasks();
      expect(known?.map((t) => [t.id, t.progressStatus])).toEqual([
        ['t1', 'COMPLETED'],
        ['t2', 'NOT_STARTED'],
        ['t3', 'NOT_STARTED'],
      ]);
      expect(known?.some((t) => 'spawnedTasks' in t)).toBe(false);
      expect(gets('/tasks')).toBe(1);
    });

    it('applies bulk status, bulk delete, delete and overdue answers', async () => {
      const { service, cache, setHandler } = await setup();
      setHandler((config) => {
        if (config.url === '/tasks/t3/overdue-checkin') return ok(config, task('t3', { progressStatus: 'COMPLETED' }));
        if (config.method !== 'get') return ok(config, { count: 1 });
        return ok(config, page([task('t1'), task('t2'), task('t3'), task('t4')]));
      });
      await service.getUserTasks();
      await service.bulkUpdateTaskStatus(['t1'], 'COMPLETED');
      await service.bulkDeleteTasks(['t2']);
      await service.confirmOverdueTask('t3', { isCompleted: true });
      await service.deleteTask('t4');
      const known = cache.peekKnownTasks();
      expect(known?.map((t) => [t.id, t.progressStatus])).toEqual([
        ['t1', 'COMPLETED'],
        ['t3', 'COMPLETED'],
      ]);
      expect(known?.[0].completedAt).not.toBeNull();
    });

    it('forgets them after a write it cannot apply', async () => {
      const { api, service, cache, setHandler } = await setup();
      setHandler((config) => ok(config, page([task('t1')])));
      await service.getUserTasks();
      await api.post('/task-packs/code/import', {});
      expect(cache.peekKnownTasks()).toBeUndefined();
    });

    it('forgets them when a task is created in another period', async () => {
      const { service, cache, setHandler } = await setup();
      setHandler((config) => (config.method === 'post' ? ok(config, task('t9')) : ok(config, page([task('t1')]))));
      await service.getUserTasks();
      await service.createTask({ title: 'x', periodId: 'p-old' } as never);
      expect(cache.peekKnownTasks()).toBeUndefined();
    });

    it('forgets them when the write fails', async () => {
      const { service, cache, setHandler } = await setup();
      setHandler((config) => (config.method === 'get' ? ok(config, page([task('t1')])) : fail(config, 500)));
      await service.getUserTasks();
      await expect(service.updateTask('t1', { progressStatus: 'COMPLETED' } as never)).rejects.toBeInstanceOf(AxiosError);
      expect(cache.peekKnownTasks()).toBeUndefined();
    });

    it('only tracks the active-period list', async () => {
      const { service, cache, setHandler } = await setup();
      setHandler((config) => ok(config, page([task('t1')])));
      await service.getUserTasks('p2');
      expect(cache.peekKnownTasks()).toBeUndefined();
    });
  });

  it('clears everything when the session ends with a 401', async () => {
    const { service, cache, gets, setHandler } = await setup();
    let sessionAlive = true;
    setHandler((config) => {
      if (config.url === '/auth/refresh') return fail(config, 401);
      if (!sessionAlive) return fail(config, 401);
      return ok(config, config.url === '/tasks' ? page([task('t1')]) : []);
    });
    await service.getUserTasks();
    await service.getUserAreas();
    sessionAlive = false;
    await expect(service.getUserAreas(undefined, true)).rejects.toBeInstanceOf(AxiosError);
    expect(location.href).toBe('/login?redirect=%2Ftasks');
    expect(cache.peekKnownTasks()).toBeUndefined();
    sessionAlive = true;
    await service.getUserTasks();
    await service.getUserAreas();
    expect(gets('/tasks')).toBe(2);
    expect(gets('/areas')).toBe(3);
  });

  it('serves a stale list while it revalidates, and announces a change', async () => {
    vi.useFakeTimers();
    const { service, cache, gets, setHandler } = await setup();
    const { getDomainVersion, DOMAIN_CHANGE_SETTLE_MS, resetDomainEventsForTests } = await import('../lib/domainEvents');
    resetDomainEventsForTests();
    let list = [task('t1')];
    setHandler((config) => ok(config, page(list)));
    await service.getUserTasks();
    vi.advanceTimersByTime(cache.TASKS_FRESH_MS);
    list = [task('t1'), task('from-the-agent')];
    await expect(service.getUserTasks()).resolves.toHaveLength(1);
    await vi.waitFor(() => expect(gets('/tasks')).toBe(2));
    await vi.advanceTimersByTimeAsync(DOMAIN_CHANGE_SETTLE_MS);
    expect(getDomainVersion('tasks')).toBe(1);
    await expect(service.getUserTasks()).resolves.toHaveLength(2);
    expect(gets('/tasks')).toBe(2);
  });
});
