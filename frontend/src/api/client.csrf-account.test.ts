import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';

// F-05: after a 403 CSRF error the client refreshes the token and replays the
// write once. If another tab signed in as a different account, the replay
// would save this tab's data into that account. It must not.

function respond(config: InternalAxiosRequestConfig, status: number, data: unknown) {
  if (status < 400) {
    return Promise.resolve({ data, status, statusText: 'OK', headers: {}, config });
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

describe('api client CSRF retry across accounts (F-05)', () => {
  const reload = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    reload.mockReset();
    vi.stubGlobal('window', {
      location: { pathname: '/wellbeing', href: 'https://app.test/wellbeing', reload },
      dispatchEvent: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function setup(csrfUserId: string) {
    const { default: api } = await import('./client');
    const { setSessionUserId } = await import('./csrfStore');
    setSessionUserId('user-a');
    const writes: string[] = [];
    api.defaults.adapter = (config: InternalAxiosRequestConfig) => {
      if (config.url === '/auth/csrf') {
        return respond(config, 200, { authenticated: true, csrfToken: 'new-token', userId: csrfUserId });
      }
      writes.push(String(config.headers['X-CSRF-Token'] ?? ''));
      if (writes.length === 1) {
        return respond(config, 403, { statusCode: 403, message: 'Invalid or missing CSRF token.' });
      }
      return respond(config, 200, { ok: true });
    };
    return { api, writes };
  }

  it('replays the write once when the session is still the same account', async () => {
    const { api, writes } = await setup('user-a');
    await api.put('/wellbeing/mood/2026-07-15', { mood: 3 });
    expect(writes).toEqual(['', 'new-token']);
    expect(reload).not.toHaveBeenCalled();
  });

  it('does not replay the write into another account and reloads the tab', async () => {
    const { api, writes } = await setup('user-b');
    await expect(api.put('/wellbeing/mood/2026-07-15', { mood: 3 })).rejects.toBeInstanceOf(AxiosError);
    expect(writes).toHaveLength(1);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
