import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';

// Sessao por dispositivo: com o JWT de acesso expirado (401) o cliente pede
// um novo em POST /auth/refresh UMA vez (partilhado entre pedidos em
// paralelo), repete o pedido e, se nao der, volta ao logout de sempre.

function respond(config: InternalAxiosRequestConfig, status: number, data: unknown) {
  if (status < 400) {
    return Promise.resolve({
      data,
      status,
      statusText: 'OK',
      headers: {},
      config,
    });
  }
  return Promise.reject(
    new AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_REQUEST', config, null, {
      status,
      statusText: 'Error',
      headers: {},
      config: { ...config, headers: new AxiosHeaders() },
      data,
    }),
  );
}

describe('api client session refresh', () => {
  const location = {
    pathname: '/tasks',
    href: 'https://app.test/tasks',
    reload: vi.fn(),
  };

  beforeEach(() => {
    vi.resetModules();
    location.pathname = '/tasks';
    location.href = 'https://app.test/tasks';
    location.reload.mockReset();
    vi.stubGlobal('window', { location, dispatchEvent: vi.fn() });
    // Sem Web Locks (como num browser antigo): cai no single-flight da tab.
    vi.stubGlobal('navigator', {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function setup(opts: { refreshOk: boolean; refreshUserId?: string }) {
    const { default: api } = await import('./client');
    const { setSessionUserId } = await import('./csrfStore');
    setSessionUserId('user-a');
    let refreshed = false;
    const calls = { refresh: 0, data: 0, csrfHeaders: [] as string[] };
    api.defaults.adapter = (config: InternalAxiosRequestConfig) => {
      if (config.url === '/auth/refresh') {
        calls.refresh += 1;
        if (!opts.refreshOk) return respond(config, 401, { message: 'Session expired.' });
        refreshed = true;
        return respond(config, 200, {
          csrfToken: 'fresh-csrf',
          userId: opts.refreshUserId ?? 'user-a',
        });
      }
      calls.data += 1;
      calls.csrfHeaders.push(String(config.headers['X-CSRF-Token'] ?? ''));
      return refreshed
        ? respond(config, 200, { ok: true })
        : respond(config, 401, { message: 'Unauthorized' });
    };
    return { api, calls };
  }

  it('refreshes once and replays the request with the new CSRF token', async () => {
    const { api, calls } = await setup({ refreshOk: true });
    const response = await api.post('/tasks', { title: 'x' });
    expect(response.data).toEqual({ ok: true });
    expect(calls.refresh).toBe(1);
    expect(calls.csrfHeaders.at(-1)).toBe('fresh-csrf');
    expect(location.href).toBe('https://app.test/tasks');
  });

  it('shares a single refresh between parallel 401s', async () => {
    const { api, calls } = await setup({ refreshOk: true });
    const results = await Promise.all([api.get('/tasks'), api.get('/areas'), api.post('/notes', {})]);
    expect(results.map((r) => r.data)).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(calls.refresh).toBe(1);
  });

  it('falls back to the logged-out redirect when the refresh fails', async () => {
    const { api, calls } = await setup({ refreshOk: false });
    await expect(api.get('/tasks')).rejects.toBeInstanceOf(AxiosError);
    expect(calls.refresh).toBe(1);
    expect(location.href).toBe('/login');
  });

  // Falha passageira do refresh (rede, 429, 5xx): a sessao pode estar valida,
  // por isso nao ha redirect nem limpeza de estado; o chamador ve o 401 original.
  function setupFlakyRefresh(refreshFailure: 'network' | 429 | 500 | 403) {
    return import('./client').then(async ({ default: api }) => {
      const { setSessionUserId, setCsrfToken, getCsrfToken } = await import('./csrfStore');
      setSessionUserId('user-a');
      setCsrfToken('old-csrf');
      let failing = true;
      let refreshed = false;
      const calls = { refresh: 0, data: 0 };
      api.defaults.adapter = (config: InternalAxiosRequestConfig) => {
        if (config.url === '/auth/refresh') {
          calls.refresh += 1;
          if (!failing) {
            refreshed = true;
            return respond(config, 200, {
              csrfToken: 'fresh-csrf',
              userId: 'user-a',
            });
          }
          if (refreshFailure === 'network') {
            return Promise.reject(new AxiosError('Network Error', 'ERR_NETWORK', config));
          }
          return respond(config, refreshFailure, { message: 'nope' });
        }
        calls.data += 1;
        return refreshed
          ? respond(config, 200, { ok: true })
          : respond(config, 401, { message: 'Unauthorized' });
      };
      return { api, calls, getCsrfToken, recover: () => (failing = false) };
    });
  }

  it.each([['network' as const], [429 as const], [500 as const]])(
    'does not log out when the refresh fails with %s',
    async (failure) => {
      const { api, calls, getCsrfToken } = await setupFlakyRefresh(failure);
      await expect(api.get('/tasks')).rejects.toMatchObject({
        response: { status: 401 },
      });
      expect(calls.refresh).toBe(1);
      expect(calls.data).toBe(1);
      expect(location.href).toBe('https://app.test/tasks');
      expect(getCsrfToken()).toBe('old-csrf');
    },
  );

  it('can refresh again on a later request after a 429', async () => {
    const { api, calls, recover } = await setupFlakyRefresh(429);
    await expect(api.get('/tasks')).rejects.toMatchObject({
      response: { status: 401 },
    });
    recover();
    const response = await api.get('/tasks');
    expect(response.data).toEqual({ ok: true });
    expect(calls.refresh).toBe(2);
    expect(location.href).toBe('https://app.test/tasks');
  });

  it('releases the Web Lock after a transient failure', async () => {
    const request = vi.fn((_name: string, cb: () => Promise<unknown>) => cb());
    vi.stubGlobal('navigator', { locks: { request } });
    const { api, recover } = await setupFlakyRefresh('network');
    await expect(api.get('/tasks')).rejects.toBeInstanceOf(AxiosError);
    recover();
    await api.get('/tasks');
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('treats a 403 from the refresh as a lost session', async () => {
    const { api } = await setupFlakyRefresh(403);
    await expect(api.get('/tasks')).rejects.toBeInstanceOf(AxiosError);
    expect(location.href).toBe('/login');
  });

  it('shares one refresh between parallel 401s even when it fails transiently', async () => {
    const { api, calls } = await setupFlakyRefresh(500);
    const results = await Promise.allSettled([api.get('/tasks'), api.get('/areas'), api.post('/notes', {})]);
    expect(results.every((r) => r.status === 'rejected')).toBe(true);
    expect(calls.refresh).toBe(1);
    expect(location.href).toBe('https://app.test/tasks');
  });

  it('does not replay into another account signed in from a different tab', async () => {
    const { api, calls } = await setup({
      refreshOk: true,
      refreshUserId: 'user-b',
    });
    await expect(api.post('/tasks', {})).rejects.toBeInstanceOf(AxiosError);
    expect(calls.data).toBe(1);
    expect(location.reload).toHaveBeenCalledTimes(1);
  });

  it('never refreshes for a failed login (wrong password stays on the page)', async () => {
    const { api, calls } = await setup({ refreshOk: true });
    location.pathname = '/login/2fa';
    await expect(api.post('/auth/2fa/login', {})).rejects.toBeInstanceOf(AxiosError);
    expect(calls.refresh).toBe(0);
  });

  it('refreshes at most once per request even if the replay is still 401 (no loop)', async () => {
    const { default: api } = await import('./client');
    let refreshes = 0;
    let dataCalls = 0;
    api.defaults.adapter = (config: InternalAxiosRequestConfig) => {
      if (config.url === '/auth/refresh') {
        refreshes += 1;
        return respond(config, 200, { csrfToken: 'fresh-csrf', userId: '' });
      }
      dataCalls += 1;
      return respond(config, 401, { message: 'Unauthorized' });
    };
    await expect(api.get('/tasks')).rejects.toBeInstanceOf(AxiosError);
    expect(refreshes).toBe(1);
    expect(dataCalls).toBe(2);
    expect(location.href).toBe('/login');
  });

  it('serialises the refresh across tabs with a Web Lock when available', async () => {
    const request = vi.fn((_name: string, cb: () => Promise<unknown>) => cb());
    vi.stubGlobal('navigator', { locks: { request } });
    const { api, calls } = await setup({ refreshOk: true });
    await api.get('/tasks');
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0]).toBe('pmaxing-session-refresh');
    expect(calls.refresh).toBe(1);
  });

  // Regressao: ensureFreshSession corre antes de sair para o Google (ligar
  // o Calendar). Com /auth/me so renovava um token JA expirado; um token a
  // segundos de expirar morria no ecra de consentimento e o callback falhava.
  it('ensureFreshSession always mints a fresh access token before leaving the app', async () => {
    const { calls } = await setup({ refreshOk: true });
    const { ensureFreshSession } = await import('./userService');
    await ensureFreshSession();
    expect(calls.refresh).toBe(1);
    expect(calls.data).toBe(0);
  });

  it('ensureFreshSession falls back to an authenticated ping without a refresh token', async () => {
    const { calls } = await setup({ refreshOk: false });
    const { ensureFreshSession } = await import('./userService');
    // /auth/me e um pedido de verificacao: o 401 nao manda para o login aqui.
    await expect(ensureFreshSession()).rejects.toBeInstanceOf(AxiosError);
    expect(calls.data).toBe(1);
    expect(location.href).toBe('https://app.test/tasks');
  });
});
