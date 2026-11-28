import { Logger } from '@nestjs/common';
import { SessionRevokeReason, type User } from '@prisma/client';
import type { Request, Response } from 'express';
import { SessionCookieService } from './session-cookie.service';
import type { AuthService } from '../auth.service';
import type { UserSessionsService } from './user-sessions.service';
import type { PrismaService } from '../../prisma/prisma.service';
import {
  ACCESS_TOKEN_COOKIE,
  CSRF_COOKIE,
  OAUTH_LOGIN_STATE_COOKIE,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_PATH,
  clearCookieOptions,
  csrfCookieOptions,
} from '../cookie.config';
import { getFrontendUrl } from '../../config/app.config';

// file-type e ESM puro (usado pelo AvatarService), o Jest nao o transforma.
jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn() }));

const USER = {
  id: 'u1',
  email: 'u1@x.test',
  role: 'USER',
  tokenVersion: 2,
  twoFactorEnabledAt: null,
} as unknown as User;
const CSRF = 'b'.repeat(64);

function setup() {
  const authService = {
    requiresTwoFactor: jest.fn().mockReturnValue(false),
    createTwoFactorChallenge: jest.fn().mockReturnValue('chal+lenge/='),
    issueJwt: jest.fn((user: User, sid: string) => `jwt:${user.id}:${sid}`),
    generateCsrfToken: jest.fn().mockReturnValue(CSRF),
    verifyAccessTokenCookie: jest.fn().mockReturnValue(null),
    getAccessSessionStatus: jest.fn().mockResolvedValue('live'),
    revokeAllSessions: jest
      .fn()
      .mockResolvedValue({ ...USER, tokenVersion: 3 }),
  };
  const userSessions = {
    create: jest
      .fn()
      .mockResolvedValue({ sessionId: 'new-session', refreshToken: 'r-new' }),
    adoptLegacy: jest
      .fn()
      .mockResolvedValue({ sessionId: 'adopted', refreshToken: 'r-adopt' }),
    rotate: jest.fn().mockResolvedValue({
      user: USER,
      sessionId: 's1',
      refreshToken: 'r-rot',
    }),
    revoke: jest.fn().mockResolvedValue(true),
    isActive: jest.fn().mockResolvedValue(true),
  };
  const prisma = { user: { findUnique: jest.fn().mockResolvedValue(USER) } };
  const service = new SessionCookieService(
    authService as unknown as AuthService,
    userSessions as unknown as UserSessionsService,
    prisma as unknown as PrismaService,
  );
  const res = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
    redirect: jest.fn(),
  };
  return { service, authService, userSessions, prisma, res };
}

function request(extra: Partial<Request> = {}): Request {
  return {
    ip: '198.51.100.7',
    headers: { 'user-agent': 'Jest UA' },
    method: 'GET',
    path: '/auth/x',
    cookies: {},
    ...extra,
  } as unknown as Request;
}

const asRes = (res: unknown) => res as Response;
const names = (mock: jest.Mock) =>
  mock.mock.calls.map((call: unknown[]) => call[0] as string);

beforeAll(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation();
  jest.spyOn(Logger.prototype, 'warn').mockImplementation();
});

afterAll(() => {
  jest.restoreAllMocks();
});

describe('SessionCookieService.clearSessionCookies', () => {
  it('clears access, CSRF and refresh cookies, the refresh one on its path', () => {
    const { service, res } = setup();
    service.clearSessionCookies(asRes(res));
    expect(names(res.clearCookie)).toEqual([
      ACCESS_TOKEN_COOKIE,
      CSRF_COOKIE,
      REFRESH_TOKEN_COOKIE,
    ]);
    expect(res.clearCookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE,
      expect.objectContaining({ path: REFRESH_TOKEN_PATH }),
    );
    expect(res.cookie).not.toHaveBeenCalled();
  });
});

describe('SessionCookieService.establishSession', () => {
  it('creates a device session and returns a fresh CSRF token', async () => {
    const { service, userSessions, res } = setup();
    const result = await service.establishSession(USER, request(), asRes(res));
    expect(result).toEqual({ csrfToken: CSRF });
    expect(userSessions.create).toHaveBeenCalledWith(USER, {
      ip: '198.51.100.7',
      userAgent: 'Jest UA',
      method: 'GET',
      path: '/auth/x',
    });
    expect(names(res.cookie)).toEqual([
      ACCESS_TOKEN_COOKIE,
      REFRESH_TOKEN_COOKIE,
      CSRF_COOKIE,
    ]);
    expect(res.cookie).toHaveBeenCalledWith(
      CSRF_COOKIE,
      CSRF,
      csrfCookieOptions(),
    );
  });
});

describe('SessionCookieService.continueDeviceSession', () => {
  const withJwt = () =>
    request({ cookies: { [ACCESS_TOKEN_COOKIE]: 'jwt' } } as Partial<Request>);

  it.each([
    ['no token', null],
    ['token without sid', { sub: 'u1', tv: 2 }],
    ['token of another user', { sub: 'u2', tv: 2, sid: 's1' }],
    ['token with an old tokenVersion', { sub: 'u1', tv: 1, sid: 's1' }],
    [
      'token issued for another purpose',
      { sub: 'u1', sid: 's1', purpose: 'link' },
    ],
  ])('returns false for %s', async (_label, payload) => {
    const { service, authService, res } = setup();
    authService.verifyAccessTokenCookie.mockReturnValue(payload);
    await expect(
      service.continueDeviceSession(USER, withJwt(), asRes(res)),
    ).resolves.toBe(false);
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('returns false when the device session is no longer active', async () => {
    const { service, authService, userSessions, res } = setup();
    authService.verifyAccessTokenCookie.mockReturnValue({
      sub: 'u1',
      tv: 2,
      sid: 's1',
    });
    userSessions.isActive.mockResolvedValue(false);
    await expect(
      service.continueDeviceSession(USER, withJwt(), asRes(res)),
    ).resolves.toBe(false);
    expect(userSessions.isActive).toHaveBeenCalledWith('s1', 'u1');
  });

  it('issues only a new access JWT for a live session of the same user', async () => {
    const { service, authService, res } = setup();
    authService.verifyAccessTokenCookie.mockReturnValue({
      sub: 'u1',
      tv: 2,
      sid: 's1',
    });
    await expect(
      service.continueDeviceSession(USER, withJwt(), asRes(res)),
    ).resolves.toBe(true);
    expect(names(res.cookie)).toEqual([ACCESS_TOKEN_COOKIE]);
    expect((res.cookie.mock.calls[0] as unknown[])[1]).toBe('jwt:u1:s1');
  });
});

describe('SessionCookieService.issueSessionAndRedirect', () => {
  it('2FA account: no session, state cookie cleared, challenge in the URL fragment', async () => {
    const { service, authService, userSessions, res } = setup();
    authService.requiresTwoFactor.mockReturnValue(true);
    await service.issueSessionAndRedirect(
      request({ user: USER } as Partial<Request>),
      asRes(res),
    );
    expect(userSessions.create).not.toHaveBeenCalled();
    expect(res.cookie).not.toHaveBeenCalled();
    expect(res.clearCookie).toHaveBeenCalledWith(
      OAUTH_LOGIN_STATE_COOKIE,
      clearCookieOptions(),
    );
    expect(res.redirect).toHaveBeenCalledWith(
      `${getFrontendUrl()}/login/2fa#token=${encodeURIComponent('chal+lenge/=')}`,
    );
  });

  it('new login: creates a session, clears the state cookie and redirects', async () => {
    const { service, userSessions, res } = setup();
    await service.issueSessionAndRedirect(
      request({ user: USER } as Partial<Request>),
      asRes(res),
    );
    expect(userSessions.create).toHaveBeenCalledTimes(1);
    expect(names(res.clearCookie)).toEqual([OAUTH_LOGIN_STATE_COOKIE]);
    expect(res.redirect).toHaveBeenCalledWith(
      `${getFrontendUrl()}/auth/callback`,
    );
  });
});

describe('SessionCookieService.refreshSession', () => {
  it('replaces a malformed CSRF cookie with a new token', async () => {
    const { service, authService, userSessions, res } = setup();
    const result = await service.refreshSession(
      request({
        cookies: {
          [REFRESH_TOKEN_COOKIE]: 'r-old',
          [CSRF_COOKIE]: 'not-a-token',
        },
      } as Partial<Request>),
      asRes(res),
    );
    expect(userSessions.rotate).toHaveBeenCalledWith(
      'r-old',
      expect.objectContaining({ ip: '198.51.100.7' }),
    );
    expect(authService.generateCsrfToken).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ csrfToken: CSRF, userId: 'u1' });
    expect(names(res.cookie)).toEqual([
      ACCESS_TOKEN_COOKIE,
      REFRESH_TOKEN_COOKIE,
      CSRF_COOKIE,
    ]);
  });
});

describe('SessionCookieService.endCurrentDevice', () => {
  it('still clears the cookies when revoking the session fails', async () => {
    const { service, authService, userSessions, res } = setup();
    authService.verifyAccessTokenCookie.mockReturnValue({
      sub: 'u1',
      sid: 's1',
    });
    userSessions.revoke.mockRejectedValue(new Error('db down'));
    await expect(
      service.endCurrentDevice(
        request({
          cookies: { [ACCESS_TOKEN_COOKIE]: 'jwt' },
        } as Partial<Request>),
        asRes(res),
      ),
    ).resolves.toBeUndefined();
    expect(userSessions.revoke).toHaveBeenCalledWith(
      'u1',
      's1',
      SessionRevokeReason.LOGOUT,
    );
    expect(names(res.clearCookie)).toEqual([
      ACCESS_TOKEN_COOKIE,
      CSRF_COOKIE,
      REFRESH_TOKEN_COOKIE,
    ]);
  });

  it('does nothing on the server without an access cookie', async () => {
    const { service, authService, userSessions, res } = setup();
    await service.endCurrentDevice(request(), asRes(res));
    expect(userSessions.revoke).not.toHaveBeenCalled();
    expect(authService.revokeAllSessions).not.toHaveBeenCalled();
    expect(res.clearCookie).toHaveBeenCalledTimes(3);
  });
});

describe('SessionCookieService.keepOnlyCurrentDevice', () => {
  it('keeps the current device with a JWT on the new tokenVersion', async () => {
    const { service, authService, userSessions, res } = setup();
    await service.keepOnlyCurrentDevice(
      { id: 'u1', email: 'u1@x.test', role: 'USER', sessionId: 's1' },
      request(),
      asRes(res),
      SessionRevokeReason.GLOBAL_SIGNOUT,
    );
    expect(authService.revokeAllSessions).toHaveBeenCalledWith(
      'u1',
      's1',
      SessionRevokeReason.GLOBAL_SIGNOUT,
    );
    expect(authService.issueJwt).toHaveBeenCalledWith(
      expect.objectContaining({ tokenVersion: 3 }),
      's1',
    );
    expect(names(res.cookie)).toEqual([ACCESS_TOKEN_COOKIE]);
    expect(userSessions.adoptLegacy).not.toHaveBeenCalled();
  });
});

describe('SessionCookieService.upgradeLegacySession', () => {
  it('returns false for a deleted account and sets no cookie', async () => {
    const { service, prisma, userSessions, res } = setup();
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(
      service.upgradeLegacySession('u1', 2, request(), asRes(res)),
    ).resolves.toBe(false);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'u1' },
    });
    expect(userSessions.adoptLegacy).not.toHaveBeenCalled();
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('adopts the legacy browser as a device session when the version matches', async () => {
    const { service, userSessions, res } = setup();
    await expect(
      service.upgradeLegacySession('u1', 2, request(), asRes(res)),
    ).resolves.toBe(true);
    expect(userSessions.adoptLegacy).toHaveBeenCalledTimes(1);
    expect(userSessions.create).not.toHaveBeenCalled();
    expect((res.cookie.mock.calls[0] as unknown[])[1]).toBe('jwt:u1:adopted');
  });
});
