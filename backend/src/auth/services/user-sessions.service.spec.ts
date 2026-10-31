import { Logger, UnauthorizedException } from '@nestjs/common';
import { SecurityEventType, SessionRevokeReason } from '@prisma/client';
import {
  UserSessionsService,
  deleteStaleUserSessions,
} from './user-sessions.service';
import { RefreshTokenCodec } from '../refresh-token.codec';
import {
  GRACE_WINDOW_MS,
  MAX_GRACE_ENTRIES,
  REFRESH_TOKEN_TTL_MS,
  REVOKED_SESSION_RETENTION_MS,
} from '../session.constants';
import type { PrismaService } from '../../prisma/prisma.service';
import type { SessionStateService } from '../../account-status/session-state.service';
import type { SecurityLogsService } from '../../security-logs/security-logs.service';

process.env.JWT_SECRET = 'user-sessions-spec-secret';

const NOW = new Date('2026-10-31T12:00:00.000Z');
// Um instante depois da janela de tolerancia de uma rotacao feita em NOW.
const AFTER_GRACE = new Date(NOW.getTime() + GRACE_WINDOW_MS + 1);
const CLIENT = {
  ip: '203.0.113.42',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/130',
  method: 'POST',
  path: '/auth/refresh',
};

interface Row {
  id: string;
  userId: string;
  refreshTokenHash: string;
  tokenVersion: number;
  userAgent: string | null;
  ipMasked: string | null;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  revokedReason: SessionRevokeReason | null;
}

type Where = Partial<{
  id: string | { not: string };
  userId: string;
  refreshTokenHash: string;
  revokedAt: null;
  expiresAt: { gt: Date };
  tokenVersion: number;
}>;

function matches(row: Row, where: Where): boolean {
  if (typeof where.id === 'string' && row.id !== where.id) return false;
  if (typeof where.id === 'object' && row.id === where.id.not) return false;
  if (where.userId !== undefined && row.userId !== where.userId) return false;
  if (
    where.refreshTokenHash !== undefined &&
    row.refreshTokenHash !== where.refreshTokenHash
  ) {
    return false;
  }
  if ('revokedAt' in where && row.revokedAt !== null) return false;
  if (where.expiresAt && !(row.expiresAt > where.expiresAt.gt)) return false;
  if (
    where.tokenVersion !== undefined &&
    row.tokenVersion !== where.tokenVersion
  ) {
    return false;
  }
  return true;
}

// Prisma em memoria com a semantica que interessa: updateMany condicional
// (compare-and-swap) e leituras que devolvem uma copia (como uma leitura
// real, nao ve escritas posteriores). `readBarrier` deixa um teste forcar
// duas leituras antes de qualquer escrita (corrida).
function fakePrisma(users: Record<string, { tokenVersion: number }>) {
  const rows = new Map<string, Row>();
  let readBarrier: {
    count: number;
    release: () => void;
    wait: Promise<void>;
  } | null = null;

  const userSession = {
    create: jest.fn(
      ({ data }: { data: Omit<Row, 'revokedAt' | 'revokedReason'> }) => {
        rows.set(data.id, { ...data, revokedAt: null, revokedReason: null });
        return Promise.resolve(data);
      },
    ),
    findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
      const row = rows.get(where.id);
      const snapshot = row
        ? {
            ...row,
            user: {
              id: row.userId,
              email: `${row.userId}@x.test`,
              role: 'USER',
              ...users[row.userId],
            },
          }
        : null;
      if (readBarrier) {
        readBarrier.count -= 1;
        if (readBarrier.count <= 0) readBarrier.release();
        await readBarrier.wait;
      }
      return snapshot;
    }),
    updateMany: jest.fn(
      ({ where, data }: { where: Where; data: Partial<Row> }) => {
        let count = 0;
        for (const row of rows.values()) {
          if (matches(row, where)) {
            Object.assign(row, data);
            count += 1;
          }
        }
        return Promise.resolve({ count });
      },
    ),
    findMany: jest.fn(
      ({ where, select }: { where: Where; select?: Record<string, true> }) =>
        Promise.resolve(
          [...rows.values()]
            .filter((row) => matches(row, where))
            .map((row) =>
              select
                ? Object.fromEntries(
                    Object.keys(select).map((key) => [
                      key,
                      row[key as keyof Row],
                    ]),
                  )
                : row,
            ),
        ),
    ),
  };

  const prisma = {
    userSession,
    $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) =>
      fn({ userSession }),
    ),
  };

  return {
    prisma,
    rows,
    barrier(reads: number) {
      let release = () => undefined as void;
      const wait = new Promise<void>((resolve) => {
        release = resolve;
      });
      readBarrier = { count: reads, release, wait };
    },
  };
}

function setup(
  users: Record<string, { tokenVersion: number }> = { u1: { tokenVersion: 0 } },
) {
  const db = fakePrisma(users);
  const sessionState = {
    get: jest.fn((userId: string) =>
      Promise.resolve(
        users[userId]
          ? { role: 'USER', tokenVersion: users[userId].tokenVersion }
          : null,
      ),
    ),
    invalidateDeviceSession: jest.fn(),
    invalidateDeviceSessionsOfUser: jest.fn(),
  };
  const securityLogs = { recordEvent: jest.fn().mockResolvedValue(undefined) };
  const service = new UserSessionsService(
    db.prisma as unknown as PrismaService,
    sessionState as unknown as SessionStateService,
    securityLogs as unknown as SecurityLogsService,
  );
  return { service, db, sessionState, securityLogs, users };
}

describe('UserSessionsService.create', () => {
  it('stores only the hash, a masked IP and the truncated user agent', async () => {
    const { service, db } = setup();
    const issued = await service.create(
      { id: 'u1', tokenVersion: 0 },
      CLIENT,
      NOW,
    );
    const row = db.rows.get(issued.sessionId)!;
    expect(row.refreshTokenHash).toBe(
      RefreshTokenCodec.hash(issued.refreshToken),
    );
    expect(row.refreshTokenHash).not.toBe(issued.refreshToken);
    expect(row.ipMasked).toBe('203.0.113.x');
    expect(row.userAgent).toBe(CLIENT.userAgent);
    expect(row.expiresAt.getTime()).toBe(NOW.getTime() + REFRESH_TOKEN_TTL_MS);
  });
});

describe('UserSessionsService.rotate', () => {
  it('rotates the token on every use and slides the expiry', async () => {
    const { service, db } = setup();
    const issued = await service.create(
      { id: 'u1', tokenVersion: 0 },
      CLIENT,
      NOW,
    );
    const later = new Date(NOW.getTime() + 60_000);

    const rotated = await service.rotate(issued.refreshToken, CLIENT, later);

    expect(rotated.sessionId).toBe(issued.sessionId);
    expect(rotated.user.id).toBe('u1');
    expect(rotated.refreshToken).not.toBe(issued.refreshToken);
    const row = db.rows.get(issued.sessionId)!;
    expect(row.refreshTokenHash).toBe(
      RefreshTokenCodec.hash(rotated.refreshToken),
    );
    expect(row.lastSeenAt).toEqual(later);
    expect(row.expiresAt.getTime()).toBe(
      later.getTime() + REFRESH_TOKEN_TTL_MS,
    );
    expect(row.revokedAt).toBeNull();
  });

  it('revokes the whole session and logs a security event when an old token is reused', async () => {
    const { service, db, securityLogs, sessionState } = setup();
    const issued = await service.create(
      { id: 'u1', tokenVersion: 0 },
      CLIENT,
      NOW,
    );
    const rotated = await service.rotate(issued.refreshToken, CLIENT, NOW);

    // Fora da janela de tolerancia: e reutilizacao, nao um retry.
    await expect(
      service.rotate(issued.refreshToken, CLIENT, AFTER_GRACE),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const row = db.rows.get(issued.sessionId)!;
    expect(row.revokedAt).toEqual(AFTER_GRACE);
    expect(row.revokedReason).toBe(SessionRevokeReason.TOKEN_REUSE);
    expect(securityLogs.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: SecurityEventType.REFRESH_TOKEN_REUSE,
        userId: 'u1',
        ip: CLIENT.ip,
        path: '/auth/refresh',
      }),
    );
    expect(sessionState.invalidateDeviceSession).toHaveBeenCalledWith(
      issued.sessionId,
    );
    // A familia toda morreu: nem o token mais recente renova.
    await expect(
      service.rotate(rotated.refreshToken, CLIENT, AFTER_GRACE),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('lets exactly one of two concurrent refreshes with the same token succeed', async () => {
    const { service, db, securityLogs } = setup();
    const issued = await service.create(
      { id: 'u1', tokenVersion: 0 },
      CLIENT,
      NOW,
    );
    // As duas leituras acontecem antes de qualquer escrita.
    db.barrier(2);

    const results = await Promise.allSettled([
      service.rotate(issued.refreshToken, CLIENT, NOW),
      service.rotate(issued.refreshToken, CLIENT, NOW),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(UnauthorizedException);
    // O vencedor continua valido: a corrida nao revogou a sessao.
    const row = db.rows.get(issued.sessionId)!;
    expect(row.revokedAt).toBeNull();
    const winner = (
      fulfilled[0] as PromiseFulfilledResult<{ refreshToken: string }>
    ).value;
    expect(row.refreshTokenHash).toBe(
      RefreshTokenCodec.hash(winner.refreshToken),
    );
    expect(securityLogs.recordEvent).not.toHaveBeenCalled();
  });

  it('rejects an expired refresh token', async () => {
    const { service } = setup();
    const issued = await service.create(
      { id: 'u1', tokenVersion: 0 },
      CLIENT,
      NOW,
    );
    const afterExpiry = new Date(NOW.getTime() + REFRESH_TOKEN_TTL_MS + 1);
    await expect(
      service.rotate(issued.refreshToken, CLIENT, afterExpiry),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a revoked session without logging a reuse', async () => {
    const { service, securityLogs } = setup();
    const issued = await service.create(
      { id: 'u1', tokenVersion: 0 },
      CLIENT,
      NOW,
    );
    await service.revoke(
      'u1',
      issued.sessionId,
      SessionRevokeReason.LOGOUT,
      NOW,
    );
    await expect(
      service.rotate(issued.refreshToken, CLIENT, NOW),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(securityLogs.recordEvent).not.toHaveBeenCalled();
  });

  it('rejects and revokes when the user tokenVersion was bumped (global sign-out)', async () => {
    const { service, db, users } = setup();
    const issued = await service.create(
      { id: 'u1', tokenVersion: 0 },
      CLIENT,
      NOW,
    );
    users.u1.tokenVersion = 1;
    await expect(
      service.rotate(issued.refreshToken, CLIENT, NOW),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(db.rows.get(issued.sessionId)!.revokedReason).toBe(
      SessionRevokeReason.GLOBAL_SIGNOUT,
    );
  });

  it('rejects forged or malformed tokens before touching the database', async () => {
    const { service, db } = setup();
    const issued = await service.create(
      { id: 'u1', tokenVersion: 0 },
      CLIENT,
      NOW,
    );
    const [id, nonce] = issued.refreshToken.split('.');
    await expect(
      service.rotate(`${id}.${nonce}.forged`, CLIENT, NOW),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.rotate(undefined, CLIENT, NOW)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(db.prisma.$transaction).not.toHaveBeenCalled();
    expect(db.rows.get(issued.sessionId)!.revokedAt).toBeNull();
  });
});

describe('UserSessionsService.rotate (adversarial)', () => {
  it('a reuse only kills that device family, never the other devices', async () => {
    const { service, db } = setup();
    const laptop = await service.create(
      { id: 'u1', tokenVersion: 0 },
      CLIENT,
      NOW,
    );
    const phone = await service.create(
      { id: 'u1', tokenVersion: 0 },
      CLIENT,
      NOW,
    );
    await service.rotate(laptop.refreshToken, CLIENT, NOW);
    await expect(
      service.rotate(laptop.refreshToken, CLIENT, AFTER_GRACE),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(db.rows.get(laptop.sessionId)!.revokedReason).toBe(
      SessionRevokeReason.TOKEN_REUSE,
    );
    expect(db.rows.get(phone.sessionId)!.revokedAt).toBeNull();
    await expect(
      service.rotate(phone.refreshToken, CLIENT, AFTER_GRACE),
    ).resolves.toMatchObject({ sessionId: phone.sessionId });
  });

  it('a well-signed token for a session that does not exist changes nothing', async () => {
    const { service, db, securityLogs } = setup();
    const ghost = new RefreshTokenCodec(process.env.JWT_SECRET!).mint(
      '7f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f',
    );
    await expect(
      service.rotate(ghost.token, CLIENT, NOW),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(db.prisma.userSession.updateMany).not.toHaveBeenCalled();
    expect(securityLogs.recordEvent).not.toHaveBeenCalled();
  });

  it('a token minted with another server secret is refused before the DB', async () => {
    const { service, db } = setup();
    const issued = await service.create(
      { id: 'u1', tokenVersion: 0 },
      CLIENT,
      NOW,
    );
    const foreign = new RefreshTokenCodec('some-other-secret').mint(
      issued.sessionId,
    );
    await expect(
      service.rotate(foreign.token, CLIENT, NOW),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    // Sem mac valido nao ha "reutilizacao": ninguem consegue revogar a sessao
    // de outra pessoa so por saber o id dela.
    expect(db.prisma.$transaction).not.toHaveBeenCalled();
    expect(db.rows.get(issued.sessionId)!.revokedAt).toBeNull();
  });

  it('adoptLegacy creates a normal rotatable session', async () => {
    const { service, db } = setup();
    const adopted = await service.adoptLegacy(
      { id: 'u1', tokenVersion: 0 },
      CLIENT,
      NOW,
    );
    expect(db.rows.get(adopted.sessionId)!.refreshTokenHash).toBe(
      RefreshTokenCodec.hash(adopted.refreshToken),
    );
    await expect(
      service.rotate(adopted.refreshToken, CLIENT, NOW),
    ).resolves.toMatchObject({ sessionId: adopted.sessionId });
  });
});

describe('UserSessionsService.rotate (lost-response grace window)', () => {
  const at = (ms: number) => new Date(NOW.getTime() + ms);
  const user = { id: 'u1', tokenVersion: 0 };
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });
  afterEach(() => warn.mockRestore());

  // T0 -> T1 em NOW, mas a resposta com T1 "perdeu-se": o cliente so tem T0.
  async function lostResponse(s: ReturnType<typeof setup>) {
    const issued = await s.service.create(user, CLIENT, NOW);
    const lost = await s.service.rotate(issued.refreshToken, CLIENT, NOW);
    return { issued, lost };
  }

  it('a retry with the previous token inside the window rotates and returns a fresh pair', async () => {
    const s = setup();
    const { issued, lost } = await lostResponse(s);

    const retried = await s.service.rotate(
      issued.refreshToken,
      CLIENT,
      at(60_000),
    );

    expect(retried.sessionId).toBe(issued.sessionId);
    expect(retried.user.id).toBe('u1');
    expect(retried.refreshToken).not.toBe(issued.refreshToken);
    expect(retried.refreshToken).not.toBe(lost.refreshToken);
    const row = s.db.rows.get(issued.sessionId)!;
    expect(row.refreshTokenHash).toBe(
      RefreshTokenCodec.hash(retried.refreshToken),
    );
    expect(row.revokedAt).toBeNull();
    expect(s.securityLogs.recordEvent).not.toHaveBeenCalled();
    // O par novo continua a rodar normalmente.
    await expect(
      s.service.rotate(retried.refreshToken, CLIENT, at(120_000)),
    ).resolves.toMatchObject({ sessionId: issued.sessionId });
  });

  it('accepts the retry exactly at the end of the window', async () => {
    const s = setup();
    const { issued } = await lostResponse(s);
    await expect(
      s.service.rotate(issued.refreshToken, CLIENT, at(GRACE_WINDOW_MS)),
    ).resolves.toMatchObject({ sessionId: issued.sessionId });
  });

  it('logs a distinct non-alarming entry and no reuse SecurityLog', async () => {
    const s = setup();
    const { issued } = await lostResponse(s);
    await s.service.rotate(issued.refreshToken, CLIENT, at(1_000));

    const messages = (warn.mock.calls as unknown[][]).map((call) =>
      String(call[0]),
    );
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('grace window');
    expect(messages[0]).toContain(issued.sessionId);
    expect(messages[0]).not.toContain('reuse');
    expect(s.securityLogs.recordEvent).not.toHaveBeenCalled();
  });

  it('the same retry after the window is reuse: revoke and log', async () => {
    const s = setup();
    const { issued } = await lostResponse(s);
    await expect(
      s.service.rotate(issued.refreshToken, CLIENT, AFTER_GRACE),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(s.db.rows.get(issued.sessionId)!.revokedReason).toBe(
      SessionRevokeReason.TOKEN_REUSE,
    );
    expect(s.securityLogs.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: SecurityEventType.REFRESH_TOKEN_REUSE }),
    );
  });

  it('a token two rotations old is reuse even inside the window', async () => {
    const s = setup();
    const issued = await s.service.create(user, CLIENT, NOW);
    const second = await s.service.rotate(issued.refreshToken, CLIENT, NOW);
    await s.service.rotate(second.refreshToken, CLIENT, at(1_000));

    await expect(
      s.service.rotate(issued.refreshToken, CLIENT, at(2_000)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(s.db.rows.get(issued.sessionId)!.revokedReason).toBe(
      SessionRevokeReason.TOKEN_REUSE,
    );
    expect(s.securityLogs.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: SecurityEventType.REFRESH_TOKEN_REUSE }),
    );
  });

  it('after a restart (empty memory) the previous token is reuse', async () => {
    const s = setup();
    const { issued } = await lostResponse(s);
    // Instancia nova sobre a mesma BD = processo reiniciado.
    const restarted = new UserSessionsService(
      s.db.prisma as unknown as PrismaService,
      s.sessionState as unknown as SessionStateService,
      s.securityLogs as unknown as SecurityLogsService,
    );
    await expect(
      restarted.rotate(issued.refreshToken, CLIENT, at(1_000)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(s.db.rows.get(issued.sessionId)!.revokedReason).toBe(
      SessionRevokeReason.TOKEN_REUSE,
    );
  });

  it('cannot chain: one grace rotation per real rotation (stolen previous token)', async () => {
    const s = setup();
    // Legitimo: T0 -> T1 (recebido). Ladrao com T0 usa-o dentro da janela.
    const { issued, lost: legit } = await lostResponse(s);
    const stolen = await s.service.rotate(
      issued.refreshToken,
      CLIENT,
      at(30_000),
    );

    // O browser legitimo (T1) apresenta agora um token "anterior" que veio de
    // uma rotacao por tolerancia: e reutilizacao, mata a familia toda.
    await expect(
      s.service.rotate(legit.refreshToken, CLIENT, at(60_000)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(s.db.rows.get(issued.sessionId)!.revokedReason).toBe(
      SessionRevokeReason.TOKEN_REUSE,
    );
    await expect(
      s.service.rotate(stolen.refreshToken, CLIENT, at(61_000)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('the previous token cannot be replayed twice inside the window', async () => {
    const s = setup();
    const { issued } = await lostResponse(s);
    await s.service.rotate(issued.refreshToken, CLIENT, at(1_000));
    await expect(
      s.service.rotate(issued.refreshToken, CLIENT, at(2_000)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(s.db.rows.get(issued.sessionId)!.revokedReason).toBe(
      SessionRevokeReason.TOKEN_REUSE,
    );
  });

  it('rejects the previous token of a revoked session without a reuse log', async () => {
    const s = setup();
    const { issued } = await lostResponse(s);
    await s.service.revoke(
      'u1',
      issued.sessionId,
      SessionRevokeReason.LOGOUT,
      at(1_000),
    );
    await expect(
      s.service.rotate(issued.refreshToken, CLIENT, at(2_000)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(s.db.rows.get(issued.sessionId)!.revokedReason).toBe(
      SessionRevokeReason.LOGOUT,
    );
    expect(s.securityLogs.recordEvent).not.toHaveBeenCalled();
  });

  it('rejects the previous token of an expired session', async () => {
    const s = setup();
    const { issued } = await lostResponse(s);
    s.db.rows.get(issued.sessionId)!.expiresAt = at(1_000);
    await expect(
      s.service.rotate(issued.refreshToken, CLIENT, at(2_000)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(s.securityLogs.recordEvent).not.toHaveBeenCalled();
  });

  it('rejects and revokes the previous token when tokenVersion is stale', async () => {
    const s = setup();
    const { issued } = await lostResponse(s);
    s.users.u1.tokenVersion = 1;
    await expect(
      s.service.rotate(issued.refreshToken, CLIENT, at(1_000)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(s.db.rows.get(issued.sessionId)!.revokedReason).toBe(
      SessionRevokeReason.GLOBAL_SIGNOUT,
    );
    expect(s.securityLogs.recordEvent).not.toHaveBeenCalled();
  });

  it('two concurrent retries with the previous token still have one winner', async () => {
    const s = setup();
    const { issued } = await lostResponse(s);
    s.db.barrier(2);

    const results = await Promise.allSettled([
      s.service.rotate(issued.refreshToken, CLIENT, at(1_000)),
      s.service.rotate(issued.refreshToken, CLIENT, at(1_000)),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(UnauthorizedException);
    const row = s.db.rows.get(issued.sessionId)!;
    expect(row.revokedAt).toBeNull();
    const winner = (
      fulfilled[0] as PromiseFulfilledResult<{ refreshToken: string }>
    ).value;
    expect(row.refreshTokenHash).toBe(
      RefreshTokenCodec.hash(winner.refreshToken),
    );
    expect(s.securityLogs.recordEvent).not.toHaveBeenCalled();
  });

  it('keeps the memory bounded, evicting the oldest rotation (back to strict)', async () => {
    const s = setup();
    const issued: { refreshToken: string; sessionId: string }[] = [];
    for (let i = 0; i <= MAX_GRACE_ENTRIES; i += 1) {
      const session = await s.service.create(user, CLIENT, NOW);
      await s.service.rotate(session.refreshToken, CLIENT, NOW);
      issued.push(session);
    }
    const memory = (
      s.service as unknown as { lastRotations: Map<string, unknown> }
    ).lastRotations;
    expect(memory.size).toBe(MAX_GRACE_ENTRIES);

    const oldest = issued[0];
    const newest = issued[issued.length - 1];
    await expect(
      s.service.rotate(oldest.refreshToken, CLIENT, at(1_000)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      s.service.rotate(newest.refreshToken, CLIENT, at(1_000)),
    ).resolves.toMatchObject({ sessionId: newest.sessionId });
  });

  it('clock skew: a retry stamped before the rotation (negative elapsed) is reuse', async () => {
    const s = setup();
    const { issued } = await lostResponse(s);
    await expect(
      s.service.rotate(issued.refreshToken, CLIENT, at(-1)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(s.db.rows.get(issued.sessionId)!.revokedReason).toBe(
      SessionRevokeReason.TOKEN_REUSE,
    );
  });

  it('sign out of the other devices inside the window: their previous token is refused, no reuse log', async () => {
    const s = setup();
    const { issued } = await lostResponse(s);
    const kept = await s.service.create(user, CLIENT, NOW);
    await s.service.revokeAllExcept(
      'u1',
      SessionRevokeReason.SIGNED_OUT_OTHERS,
      kept.sessionId,
      at(1_000),
    );
    await expect(
      s.service.rotate(issued.refreshToken, CLIENT, at(2_000)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(s.db.rows.get(issued.sessionId)!.revokedReason).toBe(
      SessionRevokeReason.SIGNED_OUT_OTHERS,
    );
    expect(s.securityLogs.recordEvent).not.toHaveBeenCalled();
    // O dispositivo mantido continua a renovar.
    await expect(
      s.service.rotate(kept.refreshToken, CLIENT, at(3_000)),
    ).resolves.toMatchObject({ sessionId: kept.sessionId });
  });

  it('a grace retry racing the current-token rotation: one winner, no revoke, and the loser is caught next time', async () => {
    const s = setup();
    // T0 (anterior, dentro da janela) e T1 (atual) apresentados ao mesmo tempo.
    const { issued, lost } = await lostResponse(s);
    s.db.barrier(2);
    const tokens = [issued.refreshToken, lost.refreshToken];
    const results = await Promise.allSettled(
      tokens.map((token) => s.service.rotate(token, CLIENT, at(1_000))),
    );

    const winners = results.flatMap((r, i) =>
      r.status === 'fulfilled' ? [{ i, value: r.value }] : [],
    );
    expect(winners).toHaveLength(1);
    const row = s.db.rows.get(issued.sessionId)!;
    expect(row.revokedAt).toBeNull();
    expect(row.refreshTokenHash).toBe(
      RefreshTokenCodec.hash(winners[0].value.refreshToken),
    );
    expect(s.securityLogs.recordEvent).not.toHaveBeenCalled();

    // Quem perdeu volta a tentar com o token que tinha: ja nao e o atual nem
    // um anterior com tolerancia livre, por isso e reutilizacao.
    const loserToken = tokens[1 - winners[0].i];
    await expect(
      s.service.rotate(loserToken, CLIENT, at(2_000)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(row.revokedReason).toBe(SessionRevokeReason.TOKEN_REUSE);
  });
});

describe('UserSessionsService ownership scoping', () => {
  it('revokeAllExcept and list never touch another user sessions', async () => {
    const { service, db } = setup({
      u1: { tokenVersion: 0 },
      u2: { tokenVersion: 0 },
    });
    const mine = await service.create(
      { id: 'u1', tokenVersion: 0 },
      CLIENT,
      NOW,
    );
    const theirs = await service.create(
      { id: 'u2', tokenVersion: 0 },
      CLIENT,
      NOW,
    );
    expect(
      await service.revokeAllExcept(
        'u1',
        SessionRevokeReason.SIGNED_OUT_OTHERS,
        undefined,
        NOW,
      ),
    ).toBe(1);
    expect(db.rows.get(mine.sessionId)!.revokedAt).not.toBeNull();
    expect(db.rows.get(theirs.sessionId)!.revokedAt).toBeNull();

    const listed = await service.list('u1', theirs.sessionId, NOW);
    expect(listed.map((s) => s.id)).not.toContain(theirs.sessionId);
  });

  it('confirmTokenVersion is scoped by user (cannot bump a foreign session)', async () => {
    const { service, db } = setup({
      u1: { tokenVersion: 0 },
      u2: { tokenVersion: 0 },
    });
    const theirs = await service.create(
      { id: 'u2', tokenVersion: 0 },
      CLIENT,
      NOW,
    );
    await service.confirmTokenVersion('u1', theirs.sessionId, 9);
    expect(db.rows.get(theirs.sessionId)!.tokenVersion).toBe(0);
  });
});

describe('UserSessionsService.revoke (ownership)', () => {
  it('revokes the caller own session', async () => {
    const { service, db, sessionState } = setup();
    const issued = await service.create(
      { id: 'u1', tokenVersion: 0 },
      CLIENT,
      NOW,
    );
    expect(
      await service.revoke(
        'u1',
        issued.sessionId,
        SessionRevokeReason.REVOKED_BY_USER,
      ),
    ).toBe(true);
    expect(db.rows.get(issued.sessionId)!.revokedAt).not.toBeNull();
    expect(sessionState.invalidateDeviceSession).toHaveBeenCalledWith(
      issued.sessionId,
    );
  });

  it('does not touch a session of another user (reported as not found)', async () => {
    const { service, db } = setup({
      u1: { tokenVersion: 0 },
      u2: { tokenVersion: 0 },
    });
    const foreign = await service.create(
      { id: 'u2', tokenVersion: 0 },
      CLIENT,
      NOW,
    );
    expect(
      await service.revoke(
        'u1',
        foreign.sessionId,
        SessionRevokeReason.REVOKED_BY_USER,
      ),
    ).toBe(false);
    expect(db.rows.get(foreign.sessionId)!.revokedAt).toBeNull();
    expect(db.prisma.userSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: foreign.sessionId,
          userId: 'u1',
        }) as unknown,
      }),
    );
  });
});

describe('UserSessionsService.list and revokeAllExcept', () => {
  it('lists active sessions and flags the current one', async () => {
    const { service } = setup();
    const a = await service.create({ id: 'u1', tokenVersion: 0 }, CLIENT, NOW);
    const b = await service.create({ id: 'u1', tokenVersion: 0 }, CLIENT, NOW);
    const revoked = await service.create(
      { id: 'u1', tokenVersion: 0 },
      CLIENT,
      NOW,
    );
    await service.revoke(
      'u1',
      revoked.sessionId,
      SessionRevokeReason.LOGOUT,
      NOW,
    );

    const list = await service.list('u1', b.sessionId, NOW);

    expect(list.map((s) => s.id).sort()).toEqual(
      [a.sessionId, b.sessionId].sort(),
    );
    expect(list.find((s) => s.id === b.sessionId)!.current).toBe(true);
    expect(list.find((s) => s.id === a.sessionId)!.current).toBe(false);
    expect(list[0]).not.toHaveProperty('refreshTokenHash');
  });

  it('hides sessions older than the last global sign-out', async () => {
    const { service, users } = setup();
    await service.create({ id: 'u1', tokenVersion: 0 }, CLIENT, NOW);
    users.u1.tokenVersion = 1;
    expect(await service.list('u1', undefined, NOW)).toEqual([]);
  });

  it('revokes every other session but keeps the current one', async () => {
    const { service, db, sessionState } = setup();
    const keep = await service.create(
      { id: 'u1', tokenVersion: 0 },
      CLIENT,
      NOW,
    );
    const other = await service.create(
      { id: 'u1', tokenVersion: 0 },
      CLIENT,
      NOW,
    );
    const count = await service.revokeAllExcept(
      'u1',
      SessionRevokeReason.SIGNED_OUT_OTHERS,
      keep.sessionId,
      NOW,
    );
    expect(count).toBe(1);
    expect(db.rows.get(keep.sessionId)!.revokedAt).toBeNull();
    expect(db.rows.get(other.sessionId)!.revokedReason).toBe(
      SessionRevokeReason.SIGNED_OUT_OTHERS,
    );
    expect(sessionState.invalidateDeviceSessionsOfUser).toHaveBeenCalledWith(
      'u1',
    );
  });
});

describe('deleteStaleUserSessions', () => {
  it('deletes expired rows and rows revoked long ago', async () => {
    const deleteMany = jest.fn().mockResolvedValue({ count: 2 });
    const count = await deleteStaleUserSessions(
      { userSession: { deleteMany } } as unknown as PrismaService,
      NOW,
    );
    expect(count).toBe(2);
    const where = (
      deleteMany.mock.calls[0] as [{ where: { OR: unknown[] } }]
    )[0].where;
    expect(where.OR).toEqual([
      { expiresAt: { lt: NOW } },
      {
        revokedAt: {
          lt: new Date(NOW.getTime() - REVOKED_SESSION_RETENTION_MS),
        },
      },
    ]);
  });
});
