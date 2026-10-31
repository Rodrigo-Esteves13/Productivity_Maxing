import { NewDeviceAlertService } from './new-device-alert.service';
import { UserSessionsService } from './user-sessions.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { MailService } from '../../mail/mail.service';
import type { PushService } from '../../push/push.service';
import type { SessionStateService } from '../../account-status/session-state.service';
import type { SecurityLogsService } from '../../security-logs/security-logs.service';
import { describeClient } from '../client-description.util';

process.env.JWT_SECRET = 'new-device-alert-spec-secret';
process.env.FRONTEND_URL = 'https://app.example.test';

const NOW = new Date('2026-10-31T12:00:00.000Z');
const CHROME_WIN =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const CHROME_WIN_NEWER =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const FIREFOX_WIN =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0';
const IP_HOME = '203.0.113.42';
const IP_OTHER = '198.51.100.7';

interface StoredSession {
  id: string;
  userId: string;
  userAgent: string | null;
  ipMasked: string | null;
}

function setup(previous: StoredSession[] = []) {
  const findMany = jest.fn(
    ({ where }: { where: { userId: string; id: { not: string } } }) =>
      Promise.resolve(
        previous
          .filter((s) => s.userId === where.userId && s.id !== where.id.not)
          .map(({ userAgent, ipMasked }) => ({ userAgent, ipMasked })),
      ),
  );
  const prisma = {
    userSession: { findMany },
    user: {
      findUnique: jest.fn().mockResolvedValue({
        email: 'rod@example.test',
        pushSubscriptions: [{ lang: 'pt' }],
      }),
    },
  };
  const mail = {
    sendNewDeviceLoginEmail: jest.fn().mockResolvedValue(true),
  };
  const push = { notifyUser: jest.fn().mockResolvedValue(1) };
  const service = new NewDeviceAlertService(
    prisma as unknown as PrismaService,
    mail as unknown as MailService,
    push as unknown as PushService,
  );
  return { service, prisma, mail, push };
}

function session(userAgent: string, ip: string, id = 'new-session') {
  return {
    userId: 'u1',
    sessionId: id,
    client: { ip, userAgent },
    at: NOW,
  };
}

const PREVIOUS_CHROME_HOME: StoredSession = {
  id: 'old',
  userId: 'u1',
  userAgent: CHROME_WIN,
  ipMasked: '203.0.113.x',
};

describe('describeClient', () => {
  it('reads browser and system families', () => {
    expect(describeClient(CHROME_WIN)).toEqual({
      browser: 'Chrome',
      os: 'Windows',
    });
    expect(describeClient(FIREFOX_WIN).browser).toBe('Firefox');
    expect(describeClient(null)).toEqual({
      browser: 'Unknown',
      os: 'Unknown',
    });
  });
});

describe('NewDeviceAlertService.checkAndNotify', () => {
  it('never alerts on the first session of an account', async () => {
    const { service, mail, push } = setup([]);
    await expect(
      service.checkAndNotify(session(CHROME_WIN, IP_HOME)),
    ).resolves.toBe(false);
    expect(mail.sendNewDeviceLoginEmail).not.toHaveBeenCalled();
    expect(push.notifyUser).not.toHaveBeenCalled();
  });

  it('does not alert for the same device (browser, system and network)', async () => {
    const { service, mail, push } = setup([PREVIOUS_CHROME_HOME]);
    // So muda a versao do Chrome: continua a ser o mesmo dispositivo.
    await expect(
      service.checkAndNotify(session(CHROME_WIN_NEWER, IP_HOME)),
    ).resolves.toBe(false);
    expect(mail.sendNewDeviceLoginEmail).not.toHaveBeenCalled();
    expect(push.notifyUser).not.toHaveBeenCalled();
  });

  it('does not count the session being created as a previous one', async () => {
    const { service, mail } = setup([
      { ...PREVIOUS_CHROME_HOME, id: 'new-session' },
    ]);
    await expect(
      service.checkAndNotify(session(CHROME_WIN, IP_HOME)),
    ).resolves.toBe(false);
    expect(mail.sendNewDeviceLoginEmail).not.toHaveBeenCalled();
  });

  it('alerts by email and push for a new browser', async () => {
    const { service, mail, push } = setup([PREVIOUS_CHROME_HOME]);
    await expect(
      service.checkAndNotify(session(FIREFOX_WIN, IP_HOME)),
    ).resolves.toBe(true);
    expect(mail.sendNewDeviceLoginEmail).toHaveBeenCalledWith(
      'rod@example.test',
      { browser: 'Firefox', os: 'Windows', ipMasked: '203.0.113.x', at: NOW },
      'https://app.example.test/devices',
      'pt',
    );
    expect(push.notifyUser).toHaveBeenCalledWith('u1', 'newDeviceLogin', {
      title: 'Firefox / Windows, 203.0.113.x',
      url: '/devices',
    });
  });

  it('alerts for a new IP on a known browser, and never leaks the full IP', async () => {
    const { service, mail, push } = setup([PREVIOUS_CHROME_HOME]);
    await expect(
      service.checkAndNotify(session(CHROME_WIN, IP_OTHER)),
    ).resolves.toBe(true);
    const [, emailDevice] = mail.sendNewDeviceLoginEmail.mock.calls[0] as [
      string,
      { ipMasked: string },
    ];
    expect(emailDevice.ipMasked).toBe('198.51.100.x');
    expect(
      JSON.stringify(mail.sendNewDeviceLoginEmail.mock.calls),
    ).not.toContain(IP_OTHER);
    expect(JSON.stringify(push.notifyUser.mock.calls)).not.toContain(IP_OTHER);
  });

  it('compares against revoked or expired sessions still stored', async () => {
    // O findMany nao filtra por revokedAt/expiresAt: uma sessao antiga que
    // ainda esta na BD conta como "ja vista".
    const { service, prisma, mail } = setup([PREVIOUS_CHROME_HOME]);
    await service.checkAndNotify(session(CHROME_WIN, IP_HOME));
    const where = (
      prisma.userSession.findMany.mock.calls[0] as [
        { where: Record<string, unknown> },
      ]
    )[0].where;
    expect(where).not.toHaveProperty('revokedAt');
    expect(where).not.toHaveProperty('expiresAt');
    expect(mail.sendNewDeviceLoginEmail).not.toHaveBeenCalled();
  });

  it('sends the push even when the email fails, and never throws', async () => {
    const { service, mail, push } = setup([PREVIOUS_CHROME_HOME]);
    mail.sendNewDeviceLoginEmail.mockRejectedValue(new Error('smtp down'));
    await expect(
      service.checkAndNotify(session(FIREFOX_WIN, IP_HOME)),
    ).resolves.toBe(true);
    expect(push.notifyUser).toHaveBeenCalledTimes(1);
  });

  it('sends the email even when the push fails, and never throws', async () => {
    const { service, mail, push } = setup([PREVIOUS_CHROME_HOME]);
    push.notifyUser.mockRejectedValue(new Error('push down'));
    await expect(
      service.checkAndNotify(session(FIREFOX_WIN, IP_HOME)),
    ).resolves.toBe(true);
    expect(mail.sendNewDeviceLoginEmail).toHaveBeenCalledTimes(1);
  });

  it('skips when the client is entirely unrecognisable', async () => {
    const { service, prisma } = setup([PREVIOUS_CHROME_HOME]);
    await expect(
      service.checkAndNotify({
        userId: 'u1',
        sessionId: 'x',
        client: {},
        at: NOW,
      }),
    ).resolves.toBe(false);
    expect(prisma.userSession.findMany).not.toHaveBeenCalled();
  });
});

describe('UserSessionsService alert wiring', () => {
  function build(alerts: { checkAndNotify: jest.Mock }) {
    const prisma = {
      userSession: {
        create: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          userSession: {
            findUnique: jest.fn().mockResolvedValue(null),
            updateMany: jest.fn(),
          },
        }),
      ),
    };
    const service = new UserSessionsService(
      prisma as unknown as PrismaService,
      {
        invalidateDeviceSession: jest.fn(),
      } as unknown as SessionStateService,
      { recordEvent: jest.fn() } as unknown as SecurityLogsService,
      alerts as unknown as NewDeviceAlertService,
    );
    return { service, prisma };
  }

  it('checks for a new device when a session is created', async () => {
    const alerts = { checkAndNotify: jest.fn().mockResolvedValue(true) };
    const { service } = build(alerts);
    const issued = await service.create(
      { id: 'u1', tokenVersion: 0 },
      { ip: IP_HOME, userAgent: CHROME_WIN },
      NOW,
    );
    await Promise.resolve();
    expect(alerts.checkAndNotify).toHaveBeenCalledTimes(1);
    expect(alerts.checkAndNotify).toHaveBeenCalledWith({
      userId: 'u1',
      sessionId: issued.sessionId,
      client: { ip: IP_HOME, userAgent: CHROME_WIN },
      at: NOW,
    });
  });

  it('login still succeeds when the alert rejects', async () => {
    const alerts = {
      checkAndNotify: jest.fn().mockRejectedValue(new Error('boom')),
    };
    const { service } = build(alerts);
    await expect(
      service.create({ id: 'u1', tokenVersion: 0 }, { ip: IP_HOME }, NOW),
    ).resolves.toMatchObject({ sessionId: expect.any(String) as string });
    await new Promise((resolve) => setImmediate(resolve));
  });

  it('login still succeeds when the alert throws synchronously', async () => {
    const alerts = {
      checkAndNotify: jest.fn(() => {
        throw new Error('sync boom');
      }),
    };
    const { service } = build(alerts);
    await expect(
      service.create({ id: 'u1', tokenVersion: 0 }, { ip: IP_HOME }, NOW),
    ).resolves.toBeDefined();
    await new Promise((resolve) => setImmediate(resolve));
  });

  it('does not wait for a slow alert (never slows login)', async () => {
    const alerts = { checkAndNotify: jest.fn(() => new Promise(() => {})) };
    const { service } = build(alerts);
    await expect(
      service.create({ id: 'u1', tokenVersion: 0 }, { ip: IP_HOME }, NOW),
    ).resolves.toBeDefined();
  });

  // Regressao: a adocao de um JWT antigo (sem `sid`) depois do deploy nao e
  // um login. Antes passava pelo create() e cada aparelho extra de um
  // utilizador recebia um falso "novo inicio de sessao".
  it('never alerts when adopting a legacy (pre-device-session) browser', async () => {
    const alerts = { checkAndNotify: jest.fn().mockResolvedValue(true) };
    const { service, prisma } = build(alerts);
    const issued = await service.adoptLegacy(
      { id: 'u1', tokenVersion: 0 },
      { ip: IP_OTHER, userAgent: FIREFOX_WIN },
      NOW,
    );
    await new Promise((resolve) => setImmediate(resolve));
    expect(issued.sessionId).toEqual(expect.any(String));
    expect(prisma.userSession.create).toHaveBeenCalledTimes(1);
    expect(alerts.checkAndNotify).not.toHaveBeenCalled();
  });

  it('does not alert on a successful refresh rotation', async () => {
    const alerts = { checkAndNotify: jest.fn().mockResolvedValue(false) };
    const { service, prisma } = build(alerts);
    const issued = await service.create(
      { id: 'u1', tokenVersion: 0 },
      { ip: IP_HOME, userAgent: CHROME_WIN },
      NOW,
    );
    await new Promise((resolve) => setImmediate(resolve));
    alerts.checkAndNotify.mockClear();

    const created = (
      prisma.userSession.create.mock.calls[0] as [
        { data: Record<string, unknown> },
      ]
    )[0].data;
    prisma.$transaction.mockImplementationOnce(
      (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          userSession: {
            findUnique: jest.fn().mockResolvedValue({
              ...created,
              revokedAt: null,
              user: { id: 'u1', tokenVersion: 0 },
            }),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
        }),
    );
    const rotated = await service.rotate(
      issued.refreshToken,
      { ip: IP_OTHER, userAgent: FIREFOX_WIN },
      NOW,
    );
    await new Promise((resolve) => setImmediate(resolve));

    expect(rotated.sessionId).toBe(issued.sessionId);
    expect(alerts.checkAndNotify).not.toHaveBeenCalled();
  });
});
