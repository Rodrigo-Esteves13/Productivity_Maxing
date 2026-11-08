import * as webpush from 'web-push';
import { isPushServiceFailure, PushService } from './push.service';
import {
  PUSH_BREAKER_FAILURE_THRESHOLD,
  PUSH_BREAKER_OPEN_MS,
  PUSH_TIMEOUT_MS,
} from '../common/http-resilience.constants';

jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn().mockResolvedValue({}),
}));

const send = webpush.sendNotification as jest.Mock;
const FCM = 'https://fcm.googleapis.com/x';
const MOZILLA = 'https://updates.push.services.mozilla.com/y';

function makeService(endpoints: string[]) {
  const prisma = {
    pushSubscription: {
      findMany: jest.fn().mockResolvedValue(
        endpoints.map((endpoint, i) => ({
          id: `s${i}`,
          endpoint,
          p256dh: 'p',
          auth: 'a',
          lang: 'en',
        })),
      ),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const service = new PushService(prisma as never);
  (service as unknown as { enabled: boolean }).enabled = true;
  return { service, prisma };
}

const notify = (service: PushService) =>
  service.notifyUser('u1', 'friendRequest', { name: 'A', url: '/friends' });

describe('PushService circuit breaker', () => {
  beforeEach(() => {
    send.mockReset().mockResolvedValue({});
    jest.useFakeTimers({ now: new Date('2026-11-06T10:00:00Z') });
  });
  afterEach(() => jest.useRealTimers());

  it('sends with a socket timeout', async () => {
    const { service } = makeService([FCM]);
    await notify(service);
    const [, , options] = send.mock.calls[0] as [unknown, string, object];
    expect(options).toMatchObject({ timeout: PUSH_TIMEOUT_MS });
  });

  it('opens per push service, fails fast with 0 delivered and keeps other services', async () => {
    const { service, prisma } = makeService([FCM]);
    send.mockRejectedValue(
      Object.assign(new Error('down'), { statusCode: 503 }),
    );
    for (let i = 0; i < PUSH_BREAKER_FAILURE_THRESHOLD; i++) {
      await expect(notify(service)).resolves.toBe(0);
    }
    send.mockClear();

    await expect(notify(service)).resolves.toBe(0);
    expect(send).not.toHaveBeenCalled();
    // Nunca apaga a subscricao por o servico estar em baixo.
    expect(prisma.pushSubscription.deleteMany).not.toHaveBeenCalled();

    // Mozilla tem o seu proprio circuito, ainda fechado.
    prisma.pushSubscription.findMany.mockResolvedValueOnce([
      { id: 'm', endpoint: MOZILLA, p256dh: 'p', auth: 'a', lang: 'en' },
    ]);
    send.mockResolvedValueOnce({});
    await expect(notify(service)).resolves.toBe(1);

    jest.advanceTimersByTime(PUSH_BREAKER_OPEN_MS);
    send.mockResolvedValueOnce({});
    await expect(notify(service)).resolves.toBe(1);
  });

  it('dead subscriptions (410) do not open the circuit', async () => {
    const { service, prisma } = makeService([FCM]);
    send.mockRejectedValue(
      Object.assign(new Error('gone'), { statusCode: 410 }),
    );
    for (let i = 0; i < PUSH_BREAKER_FAILURE_THRESHOLD * 2; i++) {
      await notify(service);
    }
    expect(send).toHaveBeenCalledTimes(PUSH_BREAKER_FAILURE_THRESHOLD * 2);
    expect(prisma.pushSubscription.deleteMany).toHaveBeenCalled();
  });

  it('local validation errors (bad keys) never open the shared circuit', async () => {
    const { service } = makeService([FCM]);
    // web-push valida as chaves antes do pedido e lanca um Error simples.
    send.mockRejectedValue(
      new Error('The subscription p256dh value should be 65 bytes long.'),
    );
    for (let i = 0; i < PUSH_BREAKER_FAILURE_THRESHOLD * 2; i++) {
      await expect(notify(service)).resolves.toBe(0);
    }
    expect(send).toHaveBeenCalledTimes(PUSH_BREAKER_FAILURE_THRESHOLD * 2);

    // Outro utilizador com chaves boas continua a receber.
    send.mockResolvedValueOnce({});
    await expect(notify(service)).resolves.toBe(1);
  });

  it('network errors and socket timeouts do open the circuit', async () => {
    const { service } = makeService([FCM]);
    send.mockRejectedValue(
      Object.assign(new Error('reset'), { code: 'ECONNRESET' }),
    );
    for (let i = 0; i < PUSH_BREAKER_FAILURE_THRESHOLD; i++) {
      await notify(service);
    }
    send.mockClear();
    await expect(notify(service)).resolves.toBe(0);
    expect(send).not.toHaveBeenCalled();
  });
});

describe('isPushServiceFailure', () => {
  it.each([
    [Object.assign(new Error('x'), { statusCode: 429 }), true],
    [Object.assign(new Error('x'), { statusCode: 503 }), true],
    [Object.assign(new Error('x'), { statusCode: 400 }), false],
    [Object.assign(new Error('x'), { statusCode: 410 }), false],
    [Object.assign(new Error('x'), { code: 'ETIMEDOUT' }), true],
    [Object.assign(new Error('x'), { code: 'ENOTFOUND' }), true],
    [Object.assign(new Error('x'), { name: 'AbortError' }), true],
    [Object.assign(new Error('x'), { name: 'TimeoutError' }), true],
    [new Error('Socket timeout'), true],
    [new Error('The subscription auth value should be 16 bytes long.'), false],
    [new TypeError('bad input'), false],
    [undefined, false],
  ])('%p -> %p', (error, expected) => {
    expect(isPushServiceFailure(error)).toBe(expected);
  });
});
