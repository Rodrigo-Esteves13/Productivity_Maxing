import { Logger } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { AuthModule } from './auth.module';
import { NewDeviceAlertService } from './services/new-device-alert.service';
import { UserSessionsService } from './services/user-sessions.service';
import { PushModule } from '../push/push.module';
import { PushService } from '../push/push.service';
import { PushController } from '../push/push.controller';
import { SecurityLogsModule } from '../security-logs/security-logs.module';
import { SecurityLogsService } from '../security-logs/security-logs.service';
import { SecurityLogsController } from '../security-logs/security-logs.controller';
import { FeedbackModule } from '../feedback/feedback.module';
import { FeedbackService } from '../feedback/feedback.service';
import { PrismaService } from '../prisma/prisma.service';

// file-type e ESM puro (usado pelo AvatarService), o Jest nao o transforma.
jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn() }));

// Valores falsos so para os construtores (strategies OAuth, Supabase, JWT)
// nao rebentarem. Sao lidos quando o modulo de teste instancia os providers
// (beforeAll), nao quando os ficheiros sao importados.
const FAKE_ENV: Record<string, string> = {
  JWT_SECRET: 'shared-providers-spec-secret',
  API_KEY_SECRET: 'shared-providers-spec-api-key',
  GOOGLE_CLIENT_ID: 'id',
  GOOGLE_CLIENT_SECRET: 'secret',
  GOOGLE_CALLBACK_URL: 'http://localhost/auth/google/callback',
  GITHUB_CLIENT_ID: 'id',
  GITHUB_CLIENT_SECRET: 'secret',
  GITHUB_CALLBACK_URL: 'http://localhost/auth/github/callback',
  DISCORD_CLIENT_ID: 'id',
  DISCORD_CLIENT_SECRET: 'secret',
  DISCORD_CALLBACK_URL: 'http://localhost/auth/discord/callback',
  SUPABASE_URL: 'http://localhost:54321',
  SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role',
};

function field<T>(instance: unknown, name: string): T {
  return (instance as Record<string, T>)[name];
}

describe('PushService and SecurityLogsService are single instances (R13)', () => {
  let moduleRef: TestingModule;
  let warn: jest.SpyInstance;
  const get = <T>(token: new (...args: never[]) => T): T =>
    moduleRef.get(token, { strict: false });

  beforeAll(async () => {
    for (const [key, value] of Object.entries(FAKE_ENV)) {
      process.env[key] ??= value;
    }
    // Sem VAPID: o PushService avisa uma vez por instancia no arranque.
    delete process.env.VAPID_PUBLIC_KEY;
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();

    moduleRef = await Test.createTestingModule({
      imports: [AuthModule, PushModule, SecurityLogsModule, FeedbackModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ user: { findMany: jest.fn().mockResolvedValue([]) } })
      .compile();
    await moduleRef.init();
  });

  afterAll(async () => {
    await moduleRef?.close();
    jest.restoreAllMocks();
  });

  it('registers each shared provider exactly once across the modules', () => {
    expect(
      moduleRef.get(PushService, { strict: false, each: true }),
    ).toHaveLength(1);
    expect(
      moduleRef.get(SecurityLogsService, { strict: false, each: true }),
    ).toHaveLength(1);
  });

  it('every consumer of PushService gets the same object', () => {
    const shared = get(PushService);
    expect(field(get(NewDeviceAlertService), 'push')).toBe(shared);
    expect(field(get(PushController), 'push')).toBe(shared);
    expect(field(get(FeedbackService), 'push')).toBe(shared);
  });

  it('every consumer of SecurityLogsService gets the same object', () => {
    const shared = get(SecurityLogsService);
    expect(field(get(UserSessionsService), 'securityLogs')).toBe(shared);
    expect(field(get(SecurityLogsController), 'securityLogsService')).toBe(
      shared,
    );
  });

  it('initialises PushService once (the missing-VAPID warning is logged once)', () => {
    const vapidWarnings = warn.mock.calls.filter((call: unknown[]) =>
      String(call[0]).includes('VAPID'),
    );
    expect(vapidWarnings).toHaveLength(1);
  });
});
