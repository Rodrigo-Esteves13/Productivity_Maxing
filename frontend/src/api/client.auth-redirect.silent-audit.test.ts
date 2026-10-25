import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';

// Silent audit (area e): /login/2fa is the page an OAuth login lands on when
// the account has 2FA. A wrong code makes POST /auth/2fa/login answer 401
// ("Invalid code."), and the global 401 interceptor treats that as an expired
// session: because the path is "/login/2fa" (not exactly "/login") it does a
// hard redirect to /login. The challenge token in the URL fragment is lost and
// the "Invalid code" message is never shown.

describe('api client 401 handling on the 2FA page (silent audit)', () => {
  const location = { pathname: '/login/2fa', href: 'https://app.test/login/2fa#token=abc' };

  beforeEach(() => {
    vi.stubGlobal('window', {
      location,
      dispatchEvent: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the user on /login/2fa when the code is wrong', async () => {
    const { default: api } = await import('./client');
    api.defaults.adapter = (config: InternalAxiosRequestConfig) =>
      Promise.reject(
        new AxiosError('Request failed with status code 401', 'ERR_BAD_REQUEST', config, null, {
          status: 401,
          statusText: 'Unauthorized',
          headers: {},
          config: { ...config, headers: new AxiosHeaders() },
          data: { statusCode: 401, message: 'Invalid code.' },
        }),
      );

    await api.post('/auth/2fa/login', { token: 'abc', code: '000000' }).catch(() => undefined);

    expect(location.href).toBe('https://app.test/login/2fa#token=abc');
  });
});
