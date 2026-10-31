import { randomUUID } from 'crypto';
import type { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  REFRESH_SESSION_TRACKER_PREFIX,
  refreshThrottleTracker,
} from './refresh-throttle.tracker';
import { RefreshTokenCodec } from './refresh-token.codec';
import { REFRESH_TOKEN_COOKIE } from './cookie.config';
import {
  REFRESH_IP_CEILING_PER_MINUTE,
  REFRESH_REQUESTS_PER_MINUTE,
} from './dto/auth-limits';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserSessionsService } from './services/user-sessions.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoggingThrottlerGuard } from '../common/guards/logging-throttler.guard';
import { SecurityLogsService } from '../security-logs/security-logs.service';
import {
  DEFAULT_REQUESTS_PER_MINUTE,
  THROTTLE_WINDOW_MS,
} from '../common/throttle.util';
import { getFrontendUrl } from '../config/app.config';

// file-type e ESM puro (usado pelo AvatarService), o Jest nao o transforma.
jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn() }));

const SECRET = process.env.JWT_SECRET || 'refresh-throttle-tracker-spec';
process.env.JWT_SECRET = SECRET;

const codec = new RefreshTokenCodec(SECRET);
const IP = '203.0.113.10';

describe('refreshThrottleTracker', () => {
  it('keys a refresh cookie with a valid HMAC by its device session', () => {
    const sessionId = randomUUID();
    const { token } = codec.mint(sessionId);
    expect(
      refreshThrottleTracker({
        ip: IP,
        cookies: { [REFRESH_TOKEN_COOKIE]: token },
      }),
    ).toBe(`${REFRESH_SESSION_TRACKER_PREFIX}${sessionId}`);
  });

  it('falls back to the IP for a forged cookie (bad HMAC)', () => {
    const forged = new RefreshTokenCodec('attacker-secret').mint(
      randomUUID(),
    ).token;
    expect(
      refreshThrottleTracker({
        ip: IP,
        cookies: { [REFRESH_TOKEN_COOKIE]: forged },
      }),
    ).toBe(IP);
  });

  it("cannot aim at another user's bucket: own valid token with the victim sid swapped in falls back to the IP", () => {
    const victimSid = randomUUID();
    const [, nonce, mac] = codec.mint(randomUUID()).token.split('.');
    const tampered = `${victimSid}.${nonce}.${mac}`;
    expect(
      refreshThrottleTracker({
        ip: IP,
        cookies: { [REFRESH_TOKEN_COOKIE]: tampered },
      }),
    ).toBe(IP);
  });

  it('falls back to the IP for a missing or malformed cookie', () => {
    expect(refreshThrottleTracker({ ip: IP, cookies: {} })).toBe(IP);
    expect(refreshThrottleTracker({ ip: IP })).toBe(IP);
    expect(
      refreshThrottleTracker({
        ip: IP,
        cookies: { [REFRESH_TOKEN_COOKIE]: `${randomUUID()}.x` },
      }),
    ).toBe(IP);
    expect(
      refreshThrottleTracker({
        ip: IP,
        cookies: { [REFRESH_TOKEN_COOKIE]: ['not', 'a', 'string'] },
      }),
    ).toBe(IP);
  });
});

// O AuthController real, com o LoggingThrottlerGuard real e o ThrottlerModule
// como no AppModule: confirma que os decoradores da rota fazem o que dizem.
describe('POST /auth/refresh rate limit (wired end to end)', () => {
  let app: INestApplication<App>;
  let recordEvent: jest.Mock;

  beforeEach(async () => {
    recordEvent = jest.fn().mockResolvedValue(undefined);
    const user = { id: 'u1', email: 'u1@x.test', role: 'USER' };
    const moduleRef = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([
          { ttl: THROTTLE_WINDOW_MS, limit: DEFAULT_REQUESTS_PER_MINUTE },
        ]),
      ],
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            issueJwt: () => 'jwt',
            generateCsrfToken: () => 'a'.repeat(64),
          },
        },
        {
          provide: UserSessionsService,
          useValue: {
            rotate: () =>
              Promise.resolve({
                user,
                sessionId: 's',
                refreshToken: 'r',
                expiresAt: new Date(),
              }),
          },
        },
        { provide: PrismaService, useValue: {} },
        { provide: SecurityLogsService, useValue: { recordEvent } },
        { provide: APP_GUARD, useClass: LoggingThrottlerGuard },
      ],
    }).compile();
    const nest = moduleRef.createNestApplication<NestExpressApplication>({
      logger: false,
    });
    nest.set('trust proxy', true);
    nest.use(cookieParser());
    await nest.init();
    app = nest;
  });

  afterEach(async () => {
    await app.close();
  });

  const refresh = (ip: string, cookie?: string) => {
    const req = request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Origin', getFrontendUrl())
      .set('X-Forwarded-For', ip);
    return cookie
      ? req.set('Cookie', `${REFRESH_TOKEN_COOKIE}=${cookie}`)
      : req;
  };

  async function burst(count: number, ip: string, cookie?: () => string) {
    const statuses: number[] = [];
    for (let i = 0; i < count; i++) {
      statuses.push((await refresh(ip, cookie?.())).status);
    }
    return statuses;
  }

  it('limits each device session on its own, not the whole NAT', async () => {
    const a = codec.mint(randomUUID()).token;
    const b = codec.mint(randomUUID()).token;
    const first = await burst(REFRESH_REQUESTS_PER_MINUTE, IP, () => a);
    expect(first.every((status) => status === 200)).toBe(true);
    expect((await refresh(IP, a)).status).toBe(429);
    // Outro estudante atras do mesmo IP continua a renovar.
    expect((await refresh(IP, b)).status).toBe(200);
    // O SecurityLog do bloqueio leva o IP, nunca o id da sessao.
    await new Promise((resolve) => setImmediate(resolve));
    expect(recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ ip: IP }),
    );
  });

  it('counts forged or missing cookies per IP, so inventing ids gives no extra quota', async () => {
    const forged = () =>
      new RefreshTokenCodec('attacker-secret').mint(randomUUID()).token;
    const statuses = await burst(REFRESH_REQUESTS_PER_MINUTE, IP, forged);
    expect(statuses.every((status) => status === 200)).toBe(true);
    expect((await refresh(IP, forged())).status).toBe(429);
    expect((await refresh(IP)).status).toBe(429);
    // Outro IP nao e afetado.
    expect((await refresh('198.51.100.7')).status).toBe(200);
  });

  it('keeps an IP-level ceiling across many valid sessions', async () => {
    const fresh = () => codec.mint(randomUUID()).token;
    const statuses = await burst(REFRESH_IP_CEILING_PER_MINUTE, IP, fresh);
    expect(statuses.every((status) => status === 200)).toBe(true);
    expect((await refresh(IP, fresh())).status).toBe(429);
    expect((await refresh('198.51.100.7', fresh())).status).toBe(200);
  });
});
