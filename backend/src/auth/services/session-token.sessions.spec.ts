import { JwtService } from '@nestjs/jwt';
import { SessionRevokeReason, type User } from '@prisma/client';
import { SessionTokenService } from './session-token.service';
import { UserSessionsService } from './user-sessions.service';
import { SessionStateService } from '../../account-status/session-state.service';
import type { SecurityLogsService } from '../../security-logs/security-logs.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';
import { ACCESS_TOKEN_TTL_SECONDS } from '../session.constants';

const SECRET = 'session-token-sessions-spec';
process.env.JWT_SECRET = process.env.JWT_SECRET || SECRET;

function setup() {
  const jwt = new JwtService({ secret: SECRET });
  const fresh = { id: 'u1', tokenVersion: 4 } as User;
  const tx = { marker: 'tx-client' };
  const events: string[] = [];
  const sessionState = {
    bumpTokenVersion: jest.fn(() => {
      events.push('bump');
      return Promise.resolve(fresh);
    }),
    invalidate: jest.fn(() => events.push('invalidate')),
    invalidateDeviceSessionsOfUser: jest.fn(() =>
      events.push('invalidateDevices'),
    ),
  };
  const userSessions = {
    revokeAllExcept: jest.fn(() => {
      events.push('revokeAllExcept');
      return Promise.resolve(2);
    }),
    confirmTokenVersion: jest.fn(() => {
      events.push('confirm');
      return Promise.resolve();
    }),
  };
  const prisma = {
    $transaction: jest.fn(async (fn: (client: unknown) => Promise<unknown>) => {
      events.push('begin');
      const result = await fn(tx);
      events.push('commit');
      return result;
    }),
  };
  const service = new SessionTokenService(
    jwt,
    sessionState as unknown as SessionStateService,
    userSessions as unknown as UserSessionsService,
    prisma as unknown as PrismaService,
  );
  return {
    jwt,
    service,
    sessionState,
    userSessions,
    prisma,
    fresh,
    tx,
    events,
  };
}

describe('SessionTokenService.issueJwt', () => {
  it('issues a short-lived access token bound to the device session', () => {
    const { jwt, service } = setup();
    const token = service.issueJwt(
      { id: 'u1', email: 'u1@x.test', role: 'USER', tokenVersion: 3 } as User,
      'session-1',
    );
    const payload = jwt.verify<JwtPayload>(token);
    expect(payload.sid).toBe('session-1');
    expect(payload.tv).toBe(3);
    expect(payload.exp! - payload.iat!).toBe(ACCESS_TOKEN_TTL_SECONDS);
  });

  it('reads an expired token only when asked to ignore the expiry (logout)', () => {
    const { jwt, service } = setup();
    const expired = jwt.sign(
      { sub: 'u1', email: 'e', role: 'USER', sid: 's1' },
      { expiresIn: -10 },
    );
    expect(service.verifyAccessTokenCookie(expired)).toBeNull();
    expect(
      service.verifyAccessTokenCookie(expired, { ignoreExpiration: true })?.sid,
    ).toBe('s1');
    // A assinatura continua a ser verificada.
    const forged = new JwtService({ secret: 'other' }).sign({ sub: 'u1' });
    expect(
      service.verifyAccessTokenCookie(forged, { ignoreExpiration: true }),
    ).toBeNull();
  });
});

describe('SessionTokenService.revokeAllSessions (global switch)', () => {
  it('bumps tokenVersion and revokes every device session', async () => {
    const { service, sessionState, userSessions, fresh, tx } = setup();
    await expect(service.revokeAllSessions('u1')).resolves.toBe(fresh);
    expect(sessionState.bumpTokenVersion).toHaveBeenCalledWith('u1', tx);
    expect(userSessions.revokeAllExcept).toHaveBeenCalledWith(
      'u1',
      SessionRevokeReason.GLOBAL_SIGNOUT,
      undefined,
      expect.any(Date),
      tx,
    );
    expect(userSessions.confirmTokenVersion).not.toHaveBeenCalled();
  });

  it('keeps the current device on the new tokenVersion', async () => {
    const { service, userSessions, tx } = setup();
    await service.revokeAllSessions(
      'u1',
      'keep-me',
      SessionRevokeReason.SIGNED_OUT_OTHERS,
    );
    expect(userSessions.revokeAllExcept).toHaveBeenCalledWith(
      'u1',
      SessionRevokeReason.SIGNED_OUT_OTHERS,
      'keep-me',
      expect.any(Date),
      tx,
    );
    expect(userSessions.confirmTokenVersion).toHaveBeenCalledWith(
      'u1',
      'keep-me',
      4,
      tx,
    );
  });

  it('issues the three writes inside one transaction and invalidates the cache after commit', async () => {
    const { service, prisma, events } = setup();
    await service.revokeAllSessions(
      'u1',
      'keep-me',
      SessionRevokeReason.SIGNED_OUT_OTHERS,
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(events).toEqual([
      'begin',
      'bump',
      'revokeAllExcept',
      'confirm',
      'commit',
      'invalidate',
      'invalidateDevices',
    ]);
  });
});

// Prisma em memoria com transacoes a serio: as escritas de um $transaction
// ficam numa copia e so passam para o estado partilhado no commit; uma
// excecao descarta-as (rollback). Escritas fora de uma transacao aplicam-se
// logo. `onTxWrite` deixa um teste correr codigo "concorrente" a meio da
// transacao, contra o estado ja commitado.
interface SessionRow {
  id: string;
  userId: string;
  tokenVersion: number;
  revokedAt: Date | null;
  revokedReason: SessionRevokeReason | null;
  expiresAt: Date;
}

interface DbState {
  users: Map<string, { id: string; role: string; tokenVersion: number }>;
  sessions: Map<string, SessionRow>;
}

type SessionWhere = {
  id?: string | { not: string };
  userId?: string;
  revokedAt?: null;
};

function cloneState(state: DbState): DbState {
  return {
    users: new Map([...state.users].map(([k, v]) => [k, { ...v }])),
    sessions: new Map([...state.sessions].map(([k, v]) => [k, { ...v }])),
  };
}

function sessionMatches(row: SessionRow, where: SessionWhere): boolean {
  if (typeof where.id === 'string' && row.id !== where.id) return false;
  if (typeof where.id === 'object' && row.id === where.id.not) return false;
  if (where.userId !== undefined && row.userId !== where.userId) return false;
  if ('revokedAt' in where && row.revokedAt !== null) return false;
  return true;
}

function transactionalPrisma(initial: DbState) {
  let committed = initial;
  const hooks: {
    onTxWrite?: (op: string) => void;
    beforeCommit?: () => Promise<unknown>;
    failOn?: string;
  } = {};

  function clientFor(read: () => DbState, inTx: boolean) {
    const write = (op: string) => {
      if (hooks.failOn === op) throw new Error(`simulated failure in ${op}`);
      if (inTx) hooks.onTxWrite?.(op);
    };
    return {
      user: {
        findUnique: jest.fn(({ where }: { where: { id: string } }) => {
          const user = read().users.get(where.id);
          return Promise.resolve(user ? { ...user } : null);
        }),
        update: jest.fn(
          ({
            where,
            data,
          }: {
            where: { id: string };
            data: { tokenVersion: { increment: number } };
          }) => {
            write('user.update');
            const user = read().users.get(where.id)!;
            user.tokenVersion += data.tokenVersion.increment;
            return Promise.resolve({ ...user });
          },
        ),
      },
      userSession: {
        findUnique: jest.fn(({ where }: { where: { id: string } }) => {
          const row = read().sessions.get(where.id);
          return Promise.resolve(row ? { ...row } : null);
        }),
        updateMany: jest.fn(
          ({
            where,
            data,
          }: {
            where: SessionWhere;
            data: Partial<SessionRow>;
          }) => {
            const op =
              'tokenVersion' in data
                ? 'userSession.confirm'
                : 'userSession.revoke';
            write(op);
            let count = 0;
            for (const row of read().sessions.values()) {
              if (sessionMatches(row, where)) {
                Object.assign(row, data);
                count += 1;
              }
            }
            return Promise.resolve({ count });
          },
        ),
      },
    };
  }

  const root = clientFor(() => committed, false);
  const prisma = {
    ...root,
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const draft = cloneState(committed);
      const result = await fn(clientFor(() => draft, true));
      await hooks.beforeCommit?.();
      committed = draft;
      return result;
    }),
  };
  return { prisma, root, hooks, state: () => committed };
}

const FUTURE = new Date(Date.now() + 24 * 60 * 60 * 1000);

function session(id: string, userId = 'u1', tokenVersion = 3): SessionRow {
  return {
    id,
    userId,
    tokenVersion,
    revokedAt: null,
    revokedReason: null,
    expiresAt: FUTURE,
  };
}

function realSetup() {
  const db = transactionalPrisma({
    users: new Map([
      ['u1', { id: 'u1', role: 'USER', tokenVersion: 3 }],
      ['u2', { id: 'u2', role: 'USER', tokenVersion: 7 }],
    ]),
    sessions: new Map([
      ['keep', session('keep')],
      ['other', session('other')],
      ['foreign', session('foreign', 'u2', 7)],
    ]),
  });
  const prisma = db.prisma as unknown as PrismaService;
  const sessionState = new SessionStateService(prisma);
  const userSessions = new UserSessionsService(prisma, sessionState, {
    recordEvent: jest.fn(),
  } as unknown as SecurityLogsService);
  const service = new SessionTokenService(
    new JwtService({ secret: SECRET }),
    sessionState,
    userSessions,
    prisma,
  );
  return { db, service, sessionState };
}

describe('SessionTokenService.revokeAllSessions is atomic (transactional fake)', () => {
  it('commits the bump, the revocation and the confirmation together', async () => {
    const { db, service } = realSetup();
    const fresh = await service.revokeAllSessions(
      'u1',
      'keep',
      SessionRevokeReason.SIGNED_OUT_OTHERS,
    );
    const state = db.state();
    expect(fresh.tokenVersion).toBe(4);
    expect(state.users.get('u1')!.tokenVersion).toBe(4);
    expect(state.sessions.get('keep')).toEqual(
      expect.objectContaining({ revokedAt: null, tokenVersion: 4 }),
    );
    expect(state.sessions.get('other')).toEqual(
      expect.objectContaining({
        revokedReason: SessionRevokeReason.SIGNED_OUT_OTHERS,
      }),
    );
    // Nada de outra conta muda.
    expect(state.sessions.get('foreign')!.revokedAt).toBeNull();
    // Nenhuma escrita foi feita fora da transacao.
    expect(db.root.user.update).not.toHaveBeenCalled();
    expect(db.root.userSession.updateMany).not.toHaveBeenCalled();
  });

  it('a failure in the last write leaves no half state behind (rollback)', async () => {
    const { db, service } = realSetup();
    db.hooks.failOn = 'userSession.confirm';
    await expect(
      service.revokeAllSessions(
        'u1',
        'keep',
        SessionRevokeReason.SIGNED_OUT_OTHERS,
      ),
    ).rejects.toThrow('simulated failure');
    const state = db.state();
    // Sem a transacao, a versao ja tinha subido e o "other" estava revogado,
    // com o "keep" preso na versao antiga (o proximo refresh revogava-o).
    expect(state.users.get('u1')!.tokenVersion).toBe(3);
    expect(state.sessions.get('other')!.revokedAt).toBeNull();
    expect(state.sessions.get('keep')).toEqual(
      expect.objectContaining({ revokedAt: null, tokenVersion: 3 }),
    );
  });

  it('a concurrent reader mid-transaction sees the old state, never a mix', async () => {
    const { db, service } = realSetup();
    const seen: Array<{ userTv: number; keepTv: number }> = [];
    db.hooks.onTxWrite = () => {
      const state = db.state();
      seen.push({
        userTv: state.users.get('u1')!.tokenVersion,
        keepTv: state.sessions.get('keep')!.tokenVersion,
      });
    };
    await service.revokeAllSessions(
      'u1',
      'keep',
      SessionRevokeReason.SIGNED_OUT_OTHERS,
    );
    expect(seen).toHaveLength(3);
    // O refresh do dispositivo a manter compara estas duas versoes: a meio da
    // transacao continuam iguais (as antigas), por isso nao o revoga.
    for (const snapshot of seen) {
      expect(snapshot.userTv).toBe(snapshot.keepTv);
    }
  });

  it('drops cached state re-read during the transaction once it commits', async () => {
    const { db, service, sessionState } = realSetup();
    // Um pedido concorrente volta a guardar em cache a versao antiga e a
    // sessao "other" ainda ativa, a meio da transacao.
    const rereads: Array<Promise<unknown>> = [];
    db.hooks.onTxWrite = (op) => {
      if (op !== 'userSession.revoke') return;
      rereads.push(sessionState.get('u1'));
      rereads.push(sessionState.isDeviceSessionActive('other', 'u1'));
    };
    // As leituras concorrentes acabam (e guardam em cache) antes do commit.
    db.hooks.beforeCommit = () => Promise.all(rereads);
    await service.revokeAllSessions(
      'u1',
      'keep',
      SessionRevokeReason.SIGNED_OUT_OTHERS,
    );
    await expect(sessionState.get('u1')).resolves.toEqual(
      expect.objectContaining({ tokenVersion: 4 }),
    );
    await expect(
      sessionState.isDeviceSessionActive('other', 'u1'),
    ).resolves.toBe(false);
  });
});
