import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Provider } from '@prisma/client';
import { SessionTokenService } from './session-token.service';
import { SessionStateService } from '../../account-status/session-state.service';
import type { UserSessionsService } from './user-sessions.service';
import type { PrismaService } from '../../prisma/prisma.service';

const SECRET = 'test-secret-for-link-state-spec';
const FUTURE = new Date(Date.now() + 24 * 60 * 60 * 1000);

function setup(
  opts: {
    tokenVersion?: number;
    session?: { userId: string; revokedAt: Date | null; expiresAt: Date };
  } = {},
) {
  const jwt = new JwtService({ secret: SECRET });
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        role: 'USER',
        tokenVersion: opts.tokenVersion ?? 0,
      }),
    },
    userSession: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(
          opts.session ?? {
            userId: where.id.replace('sid-', ''),
            revokedAt: null,
            expiresAt: FUTURE,
          },
        ),
      ),
    },
  };
  const service = new SessionTokenService(
    jwt,
    new SessionStateService(prisma as unknown as PrismaService),
    {} as UserSessionsService,
    prisma as unknown as PrismaService,
  );
  const sessionFor = (sub: string, extra: Record<string, unknown> = {}) =>
    jwt.sign({
      sub,
      email: `${sub}@example.test`,
      role: 'USER',
      tv: 0,
      sid: `sid-${sub}`,
      ...extra,
    });
  return { service, sessionFor, prisma };
}

describe('SessionTokenService.consumeLinkState', () => {
  it('accepts the state when the callback carries the same user session', async () => {
    const { service, sessionFor, prisma } = setup();
    const state = service.createLinkState('owner', Provider.GOOGLE);
    await expect(
      service.consumeLinkState(state, Provider.GOOGLE, sessionFor('owner')),
    ).resolves.toBe('owner');
    expect(prisma.userSession.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'sid-owner' } }),
    );
  });

  it('refuses a state completed by a browser with another user session', async () => {
    const { service, sessionFor } = setup();
    const state = service.createLinkState('attacker', Provider.GOOGLE);
    await expect(
      service.consumeLinkState(state, Provider.GOOGLE, sessionFor('victim')),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refuses a state completed without any session', async () => {
    const { service } = setup();
    const state = service.createLinkState('attacker', Provider.GITHUB);
    await expect(
      service.consumeLinkState(state, Provider.GITHUB, undefined),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refuses a state from another provider', async () => {
    const { service, sessionFor } = setup();
    const state = service.createLinkState('owner', Provider.DISCORD);
    await expect(
      service.consumeLinkState(state, Provider.GOOGLE, sessionFor('owner')),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refuses a session JWT whose device session was revoked (sid)', async () => {
    const { service, sessionFor } = setup({
      session: { userId: 'owner', revokedAt: new Date(), expiresAt: FUTURE },
    });
    const state = service.createLinkState('owner', Provider.GOOGLE);
    await expect(
      service.consumeLinkState(state, Provider.GOOGLE, sessionFor('owner')),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refuses a session JWT issued before a sign-out everywhere (tv)', async () => {
    const { service, sessionFor } = setup({ tokenVersion: 1 });
    const state = service.createLinkState('owner', Provider.GITHUB);
    await expect(
      service.consumeLinkState(
        state,
        Provider.GITHUB,
        sessionFor('owner', { tv: 0 }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refuses a legacy JWT (no sid) with a stale tokenVersion', async () => {
    const { service, sessionFor } = setup({ tokenVersion: 2 });
    const state = service.createLinkState('owner', Provider.DISCORD);
    await expect(
      service.consumeLinkState(
        state,
        Provider.DISCORD,
        sessionFor('owner', { sid: undefined, tv: 1 }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('SessionTokenService.getAccessSessionStatus', () => {
  const payload = (extra: Record<string, unknown> = {}) => ({
    sub: 'u1',
    email: 'u1@x.test',
    role: 'USER',
    tv: 0,
    sid: 'sid-u1',
    ...extra,
  });

  it('is live for an active device session on the current version', async () => {
    const { service } = setup();
    await expect(service.getAccessSessionStatus(payload())).resolves.toBe(
      'live',
    );
  });

  it('is revoked when the device session was revoked', async () => {
    const { service } = setup({
      session: { userId: 'u1', revokedAt: new Date(), expiresAt: FUTURE },
    });
    await expect(service.getAccessSessionStatus(payload())).resolves.toBe(
      'revoked',
    );
  });

  it('is revoked when the account no longer exists', async () => {
    const { service, prisma } = setup();
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.getAccessSessionStatus(payload())).resolves.toBe(
      'revoked',
    );
  });

  it('is stale when the tokenVersion moved on but the device is alive', async () => {
    const { service } = setup({ tokenVersion: 5 });
    await expect(service.getAccessSessionStatus(payload())).resolves.toBe(
      'stale',
    );
  });
});
