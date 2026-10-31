import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { JwtBlockedAwareStrategy } from './jwt-blocked-aware.strategy';
import { SessionStateService } from '../../account-status/session-state.service';
import type { AccountStatusService } from '../../account-status/account-status.service';
import type { PrismaService } from '../../prisma/prisma.service';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'jwt-strategy-sessions-spec';

const NOW = Date.now();

function setup(opts: {
  tokenVersion?: number;
  session?: { userId: string; revokedAt: Date | null; expiresAt: Date } | null;
}) {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        role: 'USER',
        tokenVersion: opts.tokenVersion ?? 0,
      }),
      update: jest.fn().mockResolvedValue({ id: 'u1', tokenVersion: 1 }),
    },
    userSession: {
      findUnique: jest.fn().mockResolvedValue(
        opts.session === undefined
          ? {
              userId: 'u1',
              revokedAt: null,
              expiresAt: new Date(NOW + 60_000),
            }
          : opts.session,
      ),
    },
  };
  const sessionState = new SessionStateService(
    prisma as unknown as PrismaService,
  );
  const accountStatus = {
    isBlocked: jest.fn().mockReturnValue({ blocked: false }),
  };
  const strategy = new JwtStrategy(
    accountStatus as unknown as AccountStatusService,
    sessionState,
  );
  return { strategy, sessionState, prisma };
}

const payload = (extra: Record<string, unknown> = {}) => ({
  sub: 'u1',
  email: 'u1@x.test',
  role: 'USER',
  tv: 0,
  sid: 's1',
  ...extra,
});

describe('JwtStrategy with device sessions', () => {
  it('accepts a token whose device session is active and exposes the session id', async () => {
    const { strategy } = setup({});
    await expect(strategy.validate(payload())).resolves.toEqual({
      id: 'u1',
      email: 'u1@x.test',
      role: 'USER',
      sessionId: 's1',
    });
  });

  it('rejects a token whose device session was revoked', async () => {
    const { strategy } = setup({
      session: {
        userId: 'u1',
        revokedAt: new Date(),
        expiresAt: new Date(NOW + 60_000),
      },
    });
    await expect(strategy.validate(payload())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a sid that belongs to another user', async () => {
    const { strategy } = setup({
      session: {
        userId: 'u2',
        revokedAt: null,
        expiresAt: new Date(NOW + 60_000),
      },
    });
    await expect(strategy.validate(payload())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('still rejects every token after a tokenVersion bump (global switch)', async () => {
    const { strategy } = setup({ tokenVersion: 1 });
    await expect(strategy.validate(payload({ tv: 0 }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('keeps accepting legacy tokens without sid while their version is current', async () => {
    const { strategy, prisma } = setup({});
    const { sid: _sid, ...legacy } = payload();
    void _sid;
    await expect(strategy.validate(legacy)).resolves.toMatchObject({
      id: 'u1',
    });
    expect(prisma.userSession.findUnique).not.toHaveBeenCalled();
  });

  it('makes a revocation effective at once on this instance (cache invalidated)', async () => {
    const { strategy, sessionState, prisma } = setup({});
    await strategy.validate(payload());
    prisma.userSession.findUnique.mockResolvedValue({
      userId: 'u1',
      revokedAt: new Date(),
      expiresAt: new Date(NOW + 60_000),
    });
    // Ainda em cache: passa.
    await expect(strategy.validate(payload())).resolves.toBeDefined();
    sessionState.invalidateDeviceSession('s1');
    await expect(strategy.validate(payload())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a sid whose refresh window already expired', async () => {
    const { strategy } = setup({
      session: {
        userId: 'u1',
        revokedAt: null,
        expiresAt: new Date(NOW - 1_000),
      },
    });
    await expect(strategy.validate(payload())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a sid that does not exist (deleted account / cleaned row)', async () => {
    const { strategy } = setup({ session: null });
    await expect(strategy.validate(payload())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

// A rota de bloqueio (GET /account-status/me, POST /appeals) usa a outra
// estrategia: uma sessao de dispositivo revogada tambem nao pode passar la.
describe('JwtBlockedAwareStrategy with device sessions', () => {
  function blockedAware(
    session: { userId: string; revokedAt: Date | null; expiresAt: Date } | null,
    tokenVersion = 0,
  ) {
    const { sessionState } = setup({ session, tokenVersion });
    return new JwtBlockedAwareStrategy(sessionState);
  }
  const active = {
    userId: 'u1',
    revokedAt: null,
    expiresAt: new Date(NOW + 60_000),
  };

  it('accepts an active device session and exposes its id', async () => {
    await expect(
      blockedAware(active).validate(payload()),
    ).resolves.toMatchObject({ id: 'u1', sessionId: 's1' });
  });

  it('rejects a revoked device session', async () => {
    await expect(
      blockedAware({ ...active, revokedAt: new Date() }).validate(payload()),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a sid of another user', async () => {
    await expect(
      blockedAware({ ...active, userId: 'u2' }).validate(payload()),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an old tokenVersion even with an active sid', async () => {
    await expect(
      blockedAware(active, 2).validate(payload({ tv: 1 })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('never accepts a non-session token (link state) as a session', async () => {
    await expect(
      blockedAware(active).validate(payload({ purpose: 'link' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
