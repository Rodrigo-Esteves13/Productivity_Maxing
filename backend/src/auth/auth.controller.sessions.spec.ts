import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { SessionRevokeReason, type User } from '@prisma/client';
import type { Request, Response } from 'express';
import { AuthController } from './auth.controller';
import type { AuthService } from './auth.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { UserSessionsService } from './services/user-sessions.service';
import type { AuthenticatedUser } from './interfaces/authenticated-user.interface';
import {
  ACCESS_TOKEN_COOKIE,
  CSRF_COOKIE,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_PATH,
} from './cookie.config';
import { getFrontendUrl } from '../config/app.config';

// file-type e ESM puro (usado pelo AvatarService), o Jest nao o transforma.
jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn() }));

const USER = {
  id: 'u1',
  email: 'u1@x.test',
  role: 'USER',
  tokenVersion: 0,
  twoFactorEnabledAt: null,
} as unknown as User;
const CSRF = 'a'.repeat(64);

function setup() {
  const authService = {
    loginWithPassword: jest.fn().mockResolvedValue(USER),
    requiresTwoFactor: jest.fn().mockReturnValue(false),
    issueJwt: jest.fn((user: User, sid: string) => `jwt:${user.id}:${sid}`),
    generateCsrfToken: jest.fn().mockReturnValue(CSRF),
    verifyAccessTokenCookie: jest.fn(),
    getAccessSessionStatus: jest.fn().mockResolvedValue('live'),
    revokeAllSessions: jest
      .fn()
      .mockResolvedValue({ ...USER, tokenVersion: 1 }),
    setPassword: jest.fn().mockResolvedValue(undefined),
  };
  const userSessions = {
    create: jest.fn().mockResolvedValue({
      sessionId: 'new-session',
      refreshToken: 'refresh-1',
      expiresAt: new Date(),
    }),
    adoptLegacy: jest.fn().mockResolvedValue({
      sessionId: 'adopted-session',
      refreshToken: 'refresh-legacy',
      expiresAt: new Date(),
    }),
    rotate: jest.fn().mockResolvedValue({
      user: USER,
      sessionId: 's1',
      refreshToken: 'refresh-2',
      expiresAt: new Date(),
    }),
    revoke: jest.fn().mockResolvedValue(true),
    list: jest.fn().mockResolvedValue([]),
    isActive: jest.fn().mockResolvedValue(true),
  };
  const prisma = { user: { findUnique: jest.fn().mockResolvedValue(USER) } };
  const controller = new AuthController(
    authService as unknown as AuthService,
    prisma as unknown as PrismaService,
    userSessions as unknown as UserSessionsService,
  );
  const res = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
    redirect: jest.fn(),
  };
  return { controller, authService, userSessions, prisma, res };
}

function request(extra: Partial<Request> = {}): Request {
  return {
    ip: '203.0.113.42',
    headers: { 'user-agent': 'Jest UA', origin: getFrontendUrl() },
    method: 'POST',
    path: '/auth/x',
    cookies: {},
    ...extra,
  } as unknown as Request;
}

function cookieNames(res: { cookie: jest.Mock }): string[] {
  return res.cookie.mock.calls.map((call: unknown[]) => call[0] as string);
}

describe('AuthController login paths issue device sessions', () => {
  it('password login creates a session and sets access, refresh and CSRF cookies', async () => {
    const { controller, userSessions, res } = setup();
    const result = await controller.login(
      { email: 'u1@x.test', password: 'secret-123' },
      request(),
      res as unknown as Response,
    );
    expect(result).toEqual({ csrfToken: CSRF });
    expect(userSessions.create).toHaveBeenCalledWith(
      USER,
      expect.objectContaining({ ip: '203.0.113.42', userAgent: 'Jest UA' }),
    );
    expect(cookieNames(res)).toEqual(
      expect.arrayContaining([
        ACCESS_TOKEN_COOKIE,
        REFRESH_TOKEN_COOKIE,
        CSRF_COOKIE,
      ]),
    );
    const refreshCall = res.cookie.mock.calls.find(
      (call: unknown[]) => call[0] === REFRESH_TOKEN_COOKIE,
    ) as [string, string, { httpOnly: boolean; path: string }];
    expect(refreshCall[1]).toBe('refresh-1');
    expect(refreshCall[2]).toEqual(
      expect.objectContaining({ httpOnly: true, path: REFRESH_TOKEN_PATH }),
    );
    const accessCall = res.cookie.mock.calls.find(
      (call: unknown[]) => call[0] === ACCESS_TOKEN_COOKIE,
    ) as [string, string];
    expect(accessCall[1]).toBe('jwt:u1:new-session');
  });

  it('OAuth callback creates a session before redirecting', async () => {
    const { controller, userSessions, res } = setup();
    await controller.googleCallback(
      request({ user: USER } as Partial<Request>),
      res as unknown as Response,
    );
    expect(userSessions.create).toHaveBeenCalledTimes(1);
    expect(cookieNames(res)).toEqual(
      expect.arrayContaining([ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE]),
    );
    expect(res.redirect).toHaveBeenCalledWith(
      `${getFrontendUrl()}/auth/callback`,
    );
  });

  it('OAuth link return keeps the existing device session of the same user', async () => {
    const { controller, authService, userSessions, res } = setup();
    authService.verifyAccessTokenCookie.mockReturnValue({
      sub: 'u1',
      tv: 0,
      sid: 'existing',
    });
    await controller.googleCallback(
      request({
        user: USER,
        cookies: { [ACCESS_TOKEN_COOKIE]: 'jwt' },
      } as Partial<Request>),
      res as unknown as Response,
    );
    expect(userSessions.create).not.toHaveBeenCalled();
    expect(userSessions.isActive).toHaveBeenCalledWith('existing', 'u1');
    expect(authService.issueJwt).toHaveBeenCalledWith(USER, 'existing');
  });

  it('OAuth callback with 2FA does not create a session yet', async () => {
    const { controller, authService, userSessions, res } = setup();
    authService.requiresTwoFactor.mockReturnValue(true);
    (
      authService as unknown as { createTwoFactorChallenge: jest.Mock }
    ).createTwoFactorChallenge = jest.fn().mockReturnValue('challenge');
    await controller.githubCallback(
      request({ user: USER } as Partial<Request>),
      res as unknown as Response,
    );
    expect(userSessions.create).not.toHaveBeenCalled();
  });
});

describe('AuthController.refresh', () => {
  it('rotates the refresh cookie and reuses a well-formed CSRF cookie', async () => {
    const { controller, userSessions, res } = setup();
    const result = await controller.refresh(
      request({
        cookies: { [REFRESH_TOKEN_COOKIE]: 'refresh-1', [CSRF_COOKIE]: CSRF },
      }),
      res as unknown as Response,
    );
    expect(userSessions.rotate).toHaveBeenCalledWith(
      'refresh-1',
      expect.objectContaining({ ip: '203.0.113.42' }),
    );
    expect(result).toEqual({ csrfToken: CSRF, userId: 'u1' });
    expect(cookieNames(res)).toEqual(
      expect.arrayContaining([
        ACCESS_TOKEN_COOKIE,
        REFRESH_TOKEN_COOKIE,
        CSRF_COOKIE,
      ]),
    );
  });

  it('refuses a request from another origin', async () => {
    const { controller, userSessions, res } = setup();
    await expect(
      controller.refresh(
        request({
          headers: { origin: 'https://evil.example' },
        } as Partial<Request>),
        res as unknown as Response,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(userSessions.rotate).not.toHaveBeenCalled();
  });

  it('refuses a refresh without an Origin header (not sent by the app)', async () => {
    const { controller, userSessions, res } = setup();
    await expect(
      controller.refresh(
        request({
          headers: { 'user-agent': 'curl' },
          cookies: { [REFRESH_TOKEN_COOKIE]: 'refresh-1' },
        } as Partial<Request>),
        res as unknown as Response,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(userSessions.rotate).not.toHaveBeenCalled();
  });

  it('does not clear cookies when the refresh is rejected', async () => {
    const { controller, userSessions, res } = setup();
    userSessions.rotate.mockRejectedValue(new Error('401'));
    await expect(
      controller.refresh(request(), res as unknown as Response),
    ).rejects.toThrow();
    expect(res.clearCookie).not.toHaveBeenCalled();
  });
});

describe('AuthController sessions endpoints', () => {
  const current: AuthenticatedUser = {
    id: 'u1',
    email: 'u1@x.test',
    role: 'USER',
    sessionId: 's-current',
  };

  it('lists the caller sessions passing the current session id', async () => {
    const { controller, userSessions } = setup();
    await controller.listSessions(current);
    expect(userSessions.list).toHaveBeenCalledWith('u1', 's-current');
  });

  it('returns 404 for a session id that is not the caller (foreign or unknown)', async () => {
    const { controller, userSessions, res } = setup();
    userSessions.revoke.mockResolvedValue(false);
    await expect(
      controller.revokeSession(
        current,
        'foreign-id',
        res as unknown as Response,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(userSessions.revoke).toHaveBeenCalledWith(
      'u1',
      'foreign-id',
      SessionRevokeReason.REVOKED_BY_USER,
    );
  });

  it('revoking the current session also clears this browser cookies', async () => {
    const { controller, res } = setup();
    await controller.revokeSession(
      current,
      's-current',
      res as unknown as Response,
    );
    const cleared = res.clearCookie.mock.calls.map(
      (call: unknown[]) => call[0],
    );
    expect(cleared).toEqual(
      expect.arrayContaining([
        ACCESS_TOKEN_COOKIE,
        CSRF_COOKIE,
        REFRESH_TOKEN_COOKIE,
      ]),
    );
  });

  it('sign out others keeps this device with a new access token', async () => {
    const { controller, authService, res } = setup();
    await controller.revokeOtherSessions(
      current,
      request(),
      res as unknown as Response,
    );
    expect(authService.revokeAllSessions).toHaveBeenCalledWith(
      'u1',
      's-current',
      SessionRevokeReason.SIGNED_OUT_OTHERS,
    );
    expect(authService.issueJwt).toHaveBeenCalledWith(
      expect.objectContaining({ tokenVersion: 1 }),
      's-current',
    );
  });

  it('password change on a legacy token (no sid) gives this device a new session', async () => {
    const { controller, userSessions, res } = setup();
    const legacy: AuthenticatedUser = {
      id: 'u1',
      email: 'u1@x.test',
      role: 'USER',
    };
    await controller.setPassword(
      legacy,
      { password: 'new-password-1' },
      request(),
      res as unknown as Response,
    );
    // Regressao: o browser ja tinha login, nao e um "novo dispositivo".
    expect(userSessions.adoptLegacy).toHaveBeenCalledTimes(1);
    expect(userSessions.create).not.toHaveBeenCalled();
    expect(cookieNames(res)).toEqual(
      expect.arrayContaining([REFRESH_TOKEN_COOKIE]),
    );
  });
});

describe('AuthController.logout', () => {
  it('revokes only the current device session', async () => {
    const { controller, authService, userSessions, res } = setup();
    authService.verifyAccessTokenCookie.mockReturnValue({
      sub: 'u1',
      sid: 's1',
    });
    await controller.logout(
      request({ cookies: { [ACCESS_TOKEN_COOKIE]: 'jwt' } }),
      res as unknown as Response,
    );
    expect(userSessions.revoke).toHaveBeenCalledWith(
      'u1',
      's1',
      SessionRevokeReason.LOGOUT,
    );
    expect(authService.revokeAllSessions).not.toHaveBeenCalled();
    expect(res.clearCookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE,
      expect.objectContaining({ path: REFRESH_TOKEN_PATH }),
    );
  });

  it('still revokes the device session when the access JWT already expired', async () => {
    const { controller, authService, userSessions, res } = setup();
    authService.verifyAccessTokenCookie.mockImplementation(
      (_token: string, options?: { ignoreExpiration?: boolean }) =>
        options?.ignoreExpiration ? { sub: 'u1', sid: 's1' } : null,
    );
    await controller.logout(
      request({ cookies: { [ACCESS_TOKEN_COOKIE]: 'expired' } }),
      res as unknown as Response,
    );
    expect(userSessions.revoke).toHaveBeenCalledWith(
      'u1',
      's1',
      SessionRevokeReason.LOGOUT,
    );
  });

  it('an expired legacy token (no sid) cannot trigger the global switch', async () => {
    const { controller, authService, userSessions, res } = setup();
    authService.verifyAccessTokenCookie.mockImplementation(
      (_token: string, options?: { ignoreExpiration?: boolean }) =>
        options?.ignoreExpiration ? { sub: 'u1' } : null,
    );
    await controller.logout(
      request({ cookies: { [ACCESS_TOKEN_COOKIE]: 'expired-legacy' } }),
      res as unknown as Response,
    );
    expect(authService.revokeAllSessions).not.toHaveBeenCalled();
    expect(userSessions.revoke).not.toHaveBeenCalled();
    expect(res.clearCookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE,
      expect.objectContaining({ path: REFRESH_TOKEN_PATH }),
    );
  });

  it('falls back to the global switch for a still-valid legacy token', async () => {
    const { controller, authService, userSessions, res } = setup();
    authService.verifyAccessTokenCookie.mockReturnValue({ sub: 'u1' });
    await controller.logout(
      request({ cookies: { [ACCESS_TOKEN_COOKIE]: 'jwt' } }),
      res as unknown as Response,
    );
    expect(userSessions.revoke).not.toHaveBeenCalled();
    expect(authService.revokeAllSessions).toHaveBeenCalledWith('u1');
  });
});

describe('AuthController GET /auth/csrf', () => {
  it('upgrades a legacy session (no sid) to a device session once', async () => {
    const { controller, authService, userSessions, res } = setup();
    authService.verifyAccessTokenCookie.mockReturnValue({ sub: 'u1', tv: 0 });
    const result = await controller.refreshCsrf(
      request({ cookies: { [ACCESS_TOKEN_COOKIE]: 'legacy' } }),
      res as unknown as Response,
    );
    expect(result).toEqual(expect.objectContaining({ authenticated: true }));
    // Regressao: adotar a sessao antiga nunca passa pelo create() (que
    // dispara o alerta de novo dispositivo); a cookie fica com a sessao nova.
    expect(userSessions.adoptLegacy).toHaveBeenCalledTimes(1);
    expect(userSessions.create).not.toHaveBeenCalled();
    const accessCall = res.cookie.mock.calls.find(
      (call: unknown[]) => call[0] === ACCESS_TOKEN_COOKIE,
    ) as [string, string];
    expect(accessCall[1]).toBe('jwt:u1:adopted-session');
  });

  it('does not upgrade a legacy token whose tokenVersion is stale', async () => {
    const { controller, authService, userSessions, prisma, res } = setup();
    authService.verifyAccessTokenCookie.mockReturnValue({ sub: 'u1', tv: 0 });
    prisma.user.findUnique.mockResolvedValue({ ...USER, tokenVersion: 3 });
    const result = await controller.refreshCsrf(
      request({ cookies: { [ACCESS_TOKEN_COOKIE]: 'legacy' } }),
      res as unknown as Response,
    );
    expect(result).toEqual({ authenticated: false });
    expect(userSessions.adoptLegacy).not.toHaveBeenCalled();
    expect(userSessions.create).not.toHaveBeenCalled();
  });

  it('never upgrades a token issued for another purpose (link state, 2FA)', async () => {
    const { controller, authService, userSessions, res } = setup();
    authService.verifyAccessTokenCookie.mockReturnValue({
      sub: 'u1',
      purpose: 'link',
    });
    const result = await controller.refreshCsrf(
      request({ cookies: { [ACCESS_TOKEN_COOKIE]: 'link-state' } }),
      res as unknown as Response,
    );
    expect(result).toEqual(expect.objectContaining({ authenticated: false }));
    expect(userSessions.adoptLegacy).not.toHaveBeenCalled();
  });

  it('reports a live device session as authenticated', async () => {
    const { controller, authService, res } = setup();
    authService.verifyAccessTokenCookie.mockReturnValue({
      sub: 'u1',
      tv: 0,
      sid: 's1',
    });
    const result = await controller.refreshCsrf(
      request({
        cookies: { [ACCESS_TOKEN_COOKIE]: 'jwt', [CSRF_COOKIE]: CSRF },
      }),
      res as unknown as Response,
    );
    expect(authService.getAccessSessionStatus).toHaveBeenCalledWith(
      expect.objectContaining({ sid: 's1' }),
    );
    expect(result).toEqual({
      authenticated: true,
      csrfToken: CSRF,
      userId: 'u1',
    });
  });

  it('reports a still-valid JWT of a revoked device session as signed out', async () => {
    const { controller, authService, res } = setup();
    authService.verifyAccessTokenCookie.mockReturnValue({
      sub: 'u1',
      tv: 0,
      sid: 'revoked-session',
    });
    authService.getAccessSessionStatus.mockResolvedValue('revoked');
    const result = await controller.refreshCsrf(
      request({ cookies: { [ACCESS_TOKEN_COOKIE]: 'jwt' } }),
      res as unknown as Response,
    );
    expect(result).toEqual({ authenticated: false, refreshable: false });
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('flags a live device with a stale tokenVersion as refreshable only', async () => {
    const { controller, authService, res } = setup();
    authService.verifyAccessTokenCookie.mockReturnValue({
      sub: 'u1',
      tv: 0,
      sid: 's1',
    });
    authService.getAccessSessionStatus.mockResolvedValue('stale');
    const result = await controller.refreshCsrf(
      request({ cookies: { [ACCESS_TOKEN_COOKIE]: 'jwt' } }),
      res as unknown as Response,
    );
    expect(result).toEqual({ authenticated: false, refreshable: true });
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('flags an expired access token as refreshable', async () => {
    const { controller, authService, res } = setup();
    authService.verifyAccessTokenCookie.mockImplementation(
      (_token: string, options?: { ignoreExpiration?: boolean }) =>
        options?.ignoreExpiration ? { sub: 'u1', sid: 's1' } : null,
    );
    const result = await controller.refreshCsrf(
      request({ cookies: { [ACCESS_TOKEN_COOKIE]: 'expired' } }),
      res as unknown as Response,
    );
    expect(result).toEqual({ authenticated: false, refreshable: true });
  });
});
