import { SecurityEventType, SessionRevokeReason } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import {
  SECURITY_EXPORT_EVENT_TYPES,
  SECURITY_EXPORT_MAX_EVENTS,
  SECURITY_EXPORT_MAX_SESSIONS,
  SecurityActivityService,
} from './security-activity.service';
import { SecurityActivityController } from '../security-activity.controller';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

const USER_ID = 'user-1';
const NOW = new Date('2026-11-09T12:00:00.000Z');

// Campos que nunca podem sair no export, nem ser pedidos a BD.
const FORBIDDEN_FIELDS = [
  'refreshTokenHash',
  'tokenVersion',
  'twoFactorSecret',
  'twoFactorRecoveryHashes',
  'twoFactorLastStep',
  'password',
  'passwordHash',
  'calendarFeedToken',
  'email',
  'ip',
  'path',
  'method',
];
// Valores secretos que o mock da BD devolve de proposito: se o service
// passar a linha inteira adiante, aparecem no JSON.
const SECRET_VALUES = [
  'hash-secret-abc',
  'totp-secret-xyz',
  'recovery-hash-1',
  '203.0.113.77',
];

function sessionRow(id: string, createdAt: Date) {
  const row: {
    revokedAt: Date | null;
    revokedReason: SessionRevokeReason | null;
    [key: string]: unknown;
  } = {
    id,
    userId: USER_ID,
    refreshTokenHash: 'hash-secret-abc',
    tokenVersion: 3,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/130.0',
    ipMasked: '203.0.113.x',
    createdAt,
    lastSeenAt: createdAt,
    expiresAt: new Date(createdAt.getTime() + 1000),
    revokedAt: null,
    revokedReason: null,
  };
  return row;
}

function setup(
  options: { sessions?: number; events?: number; twoFactor?: boolean } = {},
) {
  const sessions = Array.from({ length: options.sessions ?? 2 }, (_, i) =>
    sessionRow(`s${i}`, new Date(NOW.getTime() - i * 60_000)),
  );
  if (sessions[1]) {
    sessions[1] = {
      ...sessions[1],
      revokedAt: NOW,
      revokedReason: SessionRevokeReason.REVOKED_BY_USER,
    };
  }
  const events = Array.from({ length: options.events ?? 1 }, (_, i) => ({
    id: `e${i}`,
    userId: USER_ID,
    type: SecurityEventType.REFRESH_TOKEN_REUSE,
    ip: '203.0.113.77',
    method: 'POST',
    path: '/auth/refresh',
    userAgent: 'curl',
    count: 1,
    createdAt: NOW,
    updatedAt: NOW,
  }));
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: USER_ID,
        email: 'u@x.test',
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        twoFactorEnabledAt: options.twoFactor
          ? new Date('2026-02-02T00:00:00.000Z')
          : null,
        twoFactorSecret: 'totp-secret-xyz',
        twoFactorRecoveryHashes: ['recovery-hash-1'],
      }),
    },
    userSession: { findMany: jest.fn().mockResolvedValue(sessions) },
    securityLog: { findMany: jest.fn().mockResolvedValue(events) },
  };
  const service = new SecurityActivityService(
    prisma as unknown as PrismaService,
  );
  return { prisma, service };
}

interface QueryArgs {
  where: Record<string, unknown>;
  select?: Record<string, unknown>;
  orderBy?: unknown;
  take?: number;
}

function firstArg(mock: jest.Mock): QueryArgs {
  const calls = mock.mock.calls as QueryArgs[][];
  return calls[0][0];
}

function allQueryArgs(prisma: ReturnType<typeof setup>['prisma']): QueryArgs[] {
  return [
    prisma.user.findUnique,
    prisma.userSession.findMany,
    prisma.securityLog.findMany,
  ].flatMap((mock) => (mock.mock.calls as QueryArgs[][]).map((c) => c[0]));
}

describe('SecurityActivityService.exportForUser', () => {
  const originalFlag = process.env.TWO_FACTOR_ENABLED;
  afterEach(() => {
    if (originalFlag === undefined) delete process.env.TWO_FACTOR_ENABLED;
    else process.env.TWO_FACTOR_ENABLED = originalFlag;
  });

  it('filters every query by the authenticated userId', async () => {
    const { prisma, service } = setup();
    await service.exportForUser(USER_ID, 's0', NOW);

    expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.userSession.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.securityLog.findMany).toHaveBeenCalledTimes(1);
    expect(firstArg(prisma.user.findUnique).where).toEqual({
      id: USER_ID,
    });
    expect(firstArg(prisma.userSession.findMany).where.userId).toBe(USER_ID);
    expect(firstArg(prisma.securityLog.findMany).where.userId).toBe(USER_ID);
  });

  it('only selects non-secret columns', async () => {
    const { prisma, service } = setup();
    await service.exportForUser(USER_ID, 's0', NOW);
    for (const args of allQueryArgs(prisma)) {
      expect(args.select).toBeDefined();
      for (const field of FORBIDDEN_FIELDS) {
        expect(args.select).not.toHaveProperty(field);
      }
    }
  });

  it('never puts tokens, hashes, secrets or full IPs in the output', async () => {
    process.env.TWO_FACTOR_ENABLED = 'true';
    const { service } = setup({ twoFactor: true });
    const result = await service.exportForUser(USER_ID, 's0', NOW);
    const json = JSON.stringify(result);

    for (const value of SECRET_VALUES) {
      expect(json).not.toContain(value);
    }
    const keys = new Set<string>();
    const collect = (value: unknown) => {
      if (Array.isArray(value)) value.forEach(collect);
      else if (value && typeof value === 'object' && !(value instanceof Date)) {
        for (const [key, inner] of Object.entries(value)) {
          keys.add(key);
          collect(inner);
        }
      }
    };
    collect(result);
    for (const field of [...FORBIDDEN_FIELDS, 'id', 'userId']) {
      expect(keys.has(field)).toBe(false);
    }
  });

  it('maps sessions newest first with the current flag and masked IP', async () => {
    const { prisma, service } = setup();
    const result = await service.exportForUser(USER_ID, 's0', NOW);

    expect(firstArg(prisma.userSession.findMany).orderBy).toEqual({
      createdAt: 'desc',
    });
    expect(result.sessions).toHaveLength(2);
    expect(result.sessions[0].current).toBe(true);
    expect(result.sessions[1].current).toBe(false);
    expect(result.sessions[1].revokedReason).toBe(
      SessionRevokeReason.REVOKED_BY_USER,
    );
    expect(result.sessions[0].ipMasked).toBe('203.0.113.x');
    expect(result.events[0]).toEqual({
      type: SecurityEventType.REFRESH_TOKEN_REUSE,
      firstAt: NOW,
      lastAt: NOW,
      count: 1,
    });
  });

  it('only asks for the user-facing security event types', async () => {
    const { prisma, service } = setup();
    await service.exportForUser(USER_ID, undefined, NOW);
    expect(firstArg(prisma.securityLog.findMany).where.type).toEqual({
      in: [...SECURITY_EXPORT_EVENT_TYPES],
    });
  });

  it('caps sessions and events and flags truncation', async () => {
    const { prisma, service } = setup({
      sessions: SECURITY_EXPORT_MAX_SESSIONS + 1,
      events: SECURITY_EXPORT_MAX_EVENTS + 1,
    });
    const result = await service.exportForUser(USER_ID, undefined, NOW);

    expect(firstArg(prisma.userSession.findMany).take).toBe(
      SECURITY_EXPORT_MAX_SESSIONS + 1,
    );
    expect(result.sessions).toHaveLength(SECURITY_EXPORT_MAX_SESSIONS);
    expect(result.events).toHaveLength(SECURITY_EXPORT_MAX_EVENTS);
    expect(result.sessionsTruncated).toBe(true);
    expect(result.eventsTruncated).toBe(true);
    expect(result.sessions.some((s) => s.current)).toBe(false);
  });

  it('hides the 2FA date while the 2FA feature flag is off', async () => {
    process.env.TWO_FACTOR_ENABLED = 'false';
    const { service } = setup({ twoFactor: true });
    const result = await service.exportForUser(USER_ID, 's0', NOW);
    expect(result.twoFactorEnabledAt).toBeNull();
  });

  it('includes the 2FA date when the feature flag is on', async () => {
    process.env.TWO_FACTOR_ENABLED = 'true';
    const { service } = setup({ twoFactor: true });
    const result = await service.exportForUser(USER_ID, 's0', NOW);
    expect(result.twoFactorEnabledAt).toEqual(
      new Date('2026-02-02T00:00:00.000Z'),
    );
  });
});

describe('SecurityActivityController', () => {
  it('exports only the authenticated user and their current session', async () => {
    const exportForUser = jest.fn().mockResolvedValue({});
    const controller = new SecurityActivityController({
      exportForUser,
    } as unknown as SecurityActivityService);
    const user = {
      id: USER_ID,
      email: 'u@x.test',
      role: 'USER',
      sessionId: 's0',
    } as AuthenticatedUser;

    await controller.exportActivity(user);

    expect(exportForUser).toHaveBeenCalledWith(USER_ID, 's0');
  });
});
