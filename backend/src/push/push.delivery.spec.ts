import * as webpush from 'web-push';
import { DEFAULT_PUSH_TTL_SECONDS, PushService } from './push.service';

jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn().mockResolvedValue({}),
}));

// D-09: medication pushes expire with the reminder window and carry the
// send time, so a phone that was offline does not show a stale reminder as new.
describe('PushService delivery options', () => {
  function makeService() {
    const prisma = {
      pushSubscription: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 's1',
            endpoint: 'https://fcm.googleapis.com/x',
            p256dh: 'p',
            auth: 'a',
            lang: 'en',
          },
        ]),
      },
    };
    const service = new PushService(prisma as never);
    (service as unknown as { enabled: boolean }).enabled = true;
    return service;
  }

  beforeEach(() => jest.clearAllMocks());

  it('medication reminder: TTL of one hour and sentAt in the payload', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-12-01T08:00:00Z'));
    await makeService().notifyUser('u1', 'medicationDue', {
      url: '/wellbeing',
    });
    jest.useRealTimers();
    const [, payload, options] = (webpush.sendNotification as jest.Mock).mock
      .calls[0] as [unknown, string, { TTL: number }];
    expect(options.TTL).toBe(60 * 60);
    expect(JSON.parse(payload)).toMatchObject({
      tag: 'medicationDue',
      sentAt: new Date('2026-12-01T08:00:00Z').getTime(),
    });
  });

  it('other notifications keep the default TTL', async () => {
    await makeService().notifyUser('u1', 'friendRequest', {
      name: 'A',
      url: '/friends',
    });
    const [, , options] = (webpush.sendNotification as jest.Mock).mock
      .calls[0] as [unknown, string, { TTL: number }];
    expect(options.TTL).toBe(DEFAULT_PUSH_TTL_SECONDS);
  });
});
