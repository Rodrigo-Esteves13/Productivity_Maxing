import type { PrismaService } from '../prisma/prisma.service';
import type { PushService } from '../push/push.service';
import {
  AccountAnniversaryRemindersService,
  anniversaryMonths,
} from './account-anniversary-reminders.service';
import { FakeSentNotificationService } from './sent-notification.fake';

const MORNING = new Date('2026-11-11T11:00:00.000Z');
const day = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe('anniversaryMonths', () => {
  it('flags monthly milestones on the signup day', () => {
    const c = new Date('2026-08-11T09:00:00.000Z');
    expect(anniversaryMonths(c, day('2026-11-11'))).toBe(3);
    expect(anniversaryMonths(c, day('2026-11-12'))).toBeNull();
    expect(anniversaryMonths(c, day('2026-10-11'))).toBeNull();
  });
  it('flags yearly milestones and skips other months', () => {
    const c = new Date('2024-11-11T09:00:00.000Z');
    expect(anniversaryMonths(c, day('2026-11-11'))).toBe(24);
    expect(anniversaryMonths(c, day('2026-10-11'))).toBeNull();
  });
  it('clamps day 31 to the last day of a short month', () => {
    const c = new Date('2026-08-31T09:00:00.000Z');
    expect(anniversaryMonths(c, day('2026-11-30'))).toBe(3);
  });
  it('ignores the signup month', () => {
    const c = new Date('2026-11-11T09:00:00.000Z');
    expect(anniversaryMonths(c, day('2026-11-11'))).toBeNull();
  });
});

describe('AccountAnniversaryRemindersService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(MORNING);
  });
  afterEach(() => jest.useRealTimers());

  function setup(createdAt: Date, delivered = 1) {
    const prisma = {
      user: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'u1', createdAt, quietHoursStart: null, quietHoursEnd: null },
          ]),
      },
    };
    const push = { notifyUser: jest.fn().mockResolvedValue(delivered) };
    const sent = new FakeSentNotificationService();
    const service = new AccountAnniversaryRemindersService(
      prisma as unknown as PrismaService,
      push as unknown as PushService,
      sent.asService(),
    );
    return { service, push, prisma, sent };
  }

  it('pushes the month count once and scans once per day', async () => {
    const { service, push, prisma } = setup(new Date('2026-05-11T08:00:00Z'));
    expect(await service.sendReminders()).toBe(1);
    expect(push.notifyUser).toHaveBeenCalledWith('u1', 'accountAnniversary', {
      title: '6',
      count: 6,
      url: '/',
    });
    expect(await service.sendReminders()).toBe(0);
    expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
  });

  it('skips users not on a milestone', async () => {
    const { service, push } = setup(new Date('2026-09-11T08:00:00Z'));
    expect(await service.sendReminders()).toBe(0);
    expect(push.notifyUser).not.toHaveBeenCalled();
  });

  it('releases the marker when nothing was delivered', async () => {
    const { service, sent } = setup(new Date('2026-05-11T08:00:00Z'), 0);
    expect(await service.sendReminders()).toBe(0);
    expect(sent.rows.size).toBe(0);
  });
});
