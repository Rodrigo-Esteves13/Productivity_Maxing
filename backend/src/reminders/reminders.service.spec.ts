import type { PersonalNotesService } from '../personal-notes/personal-notes.service';
import type { PadsService } from '../pads/pads.service';
import type { MedicationsService } from '../wellbeing/medications.service';
import { RemindersService } from './reminders.service';
import type { AbsenceLimitRemindersService } from './absence-limit-reminders.service';
import type { AccountAnniversaryRemindersService } from './account-anniversary-reminders.service';
import type { GradeAlmostThereRemindersService } from './grade-almost-there-reminders.service';
import type { StreakRiskRemindersService } from './streak-risk-reminders.service';
import type { DueTodayRemindersService } from './due-today-reminders.service';
import type { MoneyRemindersService } from './money-reminders.service';
import type { BudgetAlertRemindersService } from './budget-alert-reminders.service';
import type { MonthlyDigestService } from './monthly-digest.service';
import type { SentNotificationService } from './sent-notification.service';
import { SENT_NOTIFICATION_RETENTION_DAYS } from './sent-notification.constants';
import type { PrismaService } from '../prisma/prisma.service';
import type { MailService } from '../mail/mail.service';
import type { PushService } from '../push/push.service';
import { REVOKED_SESSION_RETENTION_MS } from '../auth/session.constants';

const NOW = new Date('2026-10-19T10:00:00.000Z');
// Task com hora, a 2h do NOW: o lembrete (24h antes) ja pode sair.
const SOON = new Date('2026-10-19T12:00:00.000Z');

interface Prefs {
  deadlineEmailReminders: boolean;
  deadlinePushReminders: boolean;
}

function task(id: string, userId: string, prefs: Prefs) {
  return {
    id,
    title: `Task ${id}`,
    date: SOON,
    submissionDate: null as Date | null,
    userId,
    area: null,
    user: {
      email: `${userId}@example.test`,
      quietHoursStart: null,
      quietHoursEnd: null,
      ...prefs,
    },
    sentReminders: [],
  };
}

function setup(
  tasks: ReturnType<typeof task>[],
  opts: { mailOk?: boolean; pushDelivered?: number; purged?: number } = {},
) {
  const prisma = {
    task: { findMany: jest.fn().mockResolvedValue(tasks) },
    sentReminder: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
    userSession: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
  };
  const mail = {
    sendDeadlineReminderEmail: jest.fn().mockResolvedValue(opts.mailOk ?? true),
  };
  const push = {
    notifyUser: jest.fn().mockResolvedValue(opts.pushDelivered ?? 1),
  };
  const sentNotifications = {
    purgeOlderThan: jest.fn().mockResolvedValue(opts.purged ?? 0),
  };
  const service = new RemindersService(
    prisma as unknown as PrismaService,
    mail as unknown as MailService,
    push as unknown as PushService,
    {
      sendDueReminders: jest.fn().mockResolvedValue(0),
    } as unknown as MedicationsService,
    {
      deleteExpired: jest.fn().mockResolvedValue(0),
    } as unknown as PadsService,
    {
      sendDueReminders: jest.fn().mockResolvedValue(0),
    } as unknown as PersonalNotesService,
    {
      sendWeeklyReminders: jest.fn().mockResolvedValue(0),
    } as unknown as AbsenceLimitRemindersService,
    {
      sendReminders: jest.fn().mockResolvedValue(0),
    } as unknown as StreakRiskRemindersService,
    {
      sendReminders: jest.fn().mockResolvedValue(0),
    } as unknown as DueTodayRemindersService,
    {
      sendReminders: jest.fn().mockResolvedValue(0),
    } as unknown as MoneyRemindersService,
    {
      sendReminders: jest.fn().mockResolvedValue(0),
    } as unknown as BudgetAlertRemindersService,
    {
      sendDigests: jest.fn().mockResolvedValue(0),
    } as unknown as MonthlyDigestService,
    sentNotifications as unknown as SentNotificationService,
    {
      sendReminders: jest.fn().mockResolvedValue(0),
    } as unknown as GradeAlmostThereRemindersService,
    {
      sendReminders: jest.fn().mockResolvedValue(0),
    } as unknown as AccountAnniversaryRemindersService,
  );
  return { service, prisma, mail, push, sentNotifications };
}

describe('RemindersService.run', () => {
  it('purges old sent-notification markers with the retention constant', async () => {
    const { service, sentNotifications } = setup([], { purged: 3 });
    const result = await service.run(NOW);
    expect(sentNotifications.purgeOlderThan).toHaveBeenCalledWith(
      SENT_NOTIFICATION_RETENTION_DAYS,
      NOW,
    );
    expect(result.sentNotificationsPurged).toBe(3);
  });

  it('a failing marker purge does not fail the run', async () => {
    const { service, sentNotifications } = setup([]);
    sentNotifications.purgeOlderThan.mockRejectedValue(new Error('db down'));
    const result = await service.run(NOW);
    expect(result.sentNotificationsPurged).toBe(0);
  });

  it('single-flight: an overlapping call gets the in-flight run', async () => {
    const prefs = {
      deadlineEmailReminders: false,
      deadlinePushReminders: true,
    };
    const { service, prisma, push } = setup([task('a', 'u1', prefs)]);
    const first = service.run(NOW);
    const second = service.run(NOW);
    expect(second).toBe(first);
    await Promise.all([first, second]);
    expect(prisma.task.findMany).toHaveBeenCalledTimes(1);
    expect(push.notifyUser).toHaveBeenCalledTimes(1);
    // Terminada, a proxima chamada corre outra vez.
    await service.run(NOW);
    expect(prisma.task.findMany).toHaveBeenCalledTimes(2);
  });

  it('only asks Prisma for users with at least one reminder channel on', async () => {
    const { service, prisma } = setup([]);
    await service.run(NOW);
    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          user: expect.objectContaining({
            OR: [
              { deadlineEmailReminders: true },
              { deadlinePushReminders: true },
            ],
          }) as unknown,
        }) as unknown,
      }),
    );
  });

  it('sends a push but no email for a push-only user', async () => {
    const prefs = {
      deadlineEmailReminders: false,
      deadlinePushReminders: true,
    };
    const { service, mail, push, prisma } = setup([task('a', 'u1', prefs)]);
    const result = await service.run(NOW);
    expect(mail.sendDeadlineReminderEmail).not.toHaveBeenCalled();
    expect(push.notifyUser).toHaveBeenCalledWith('u1', 'deadlineSoon', {
      title: 'Task a',
      count: 0,
      url: '/tasks',
    });
    expect(prisma.sentReminder.createMany).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      usersEmailed: 0,
      usersPushed: 1,
      remindersSent: 1,
      medicationUsersPushed: 0,
      personalRemindersSent: 0,
      absenceLimitUsersPushed: 0,
      streakRiskUsersPushed: 0,
      dueTodayUsersPushed: 0,
      moneyUsersPushed: 0,
      budgetUsersPushed: 0,
      almostThereUsersPushed: 0,
      anniversaryUsersPushed: 0,
      monthlyDigestSent: 0,
      expiredPadsDeleted: 0,
      staleSessionsDeleted: 0,
      sentNotificationsPurged: 0,
    });
  });

  it('groups several tasks into one push with the count of the others', async () => {
    const prefs = {
      deadlineEmailReminders: false,
      deadlinePushReminders: true,
    };
    const { service, push } = setup([
      task('a', 'u1', prefs),
      task('b', 'u1', prefs),
      task('c', 'u1', prefs),
    ]);
    await service.run(NOW);
    expect(push.notifyUser).toHaveBeenCalledTimes(1);
    expect(push.notifyUser).toHaveBeenCalledWith('u1', 'deadlinesSoon', {
      title: 'Task a',
      count: 2,
      url: '/tasks',
    });
  });

  it('sends only email for an email-only user', async () => {
    const prefs = {
      deadlineEmailReminders: true,
      deadlinePushReminders: false,
    };
    const { service, mail, push } = setup([task('a', 'u1', prefs)]);
    const result = await service.run(NOW);
    expect(mail.sendDeadlineReminderEmail).toHaveBeenCalledTimes(1);
    expect(push.notifyUser).not.toHaveBeenCalled();
    expect(result.usersEmailed).toBe(1);
  });

  it('marks the reminder as sent when the push arrived even if the email failed', async () => {
    const prefs = { deadlineEmailReminders: true, deadlinePushReminders: true };
    const { service, prisma } = setup([task('a', 'u1', prefs)], {
      mailOk: false,
      pushDelivered: 1,
    });
    const result = await service.run(NOW);
    expect(prisma.sentReminder.createMany).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      usersEmailed: 0,
      usersPushed: 1,
      remindersSent: 1,
      medicationUsersPushed: 0,
      personalRemindersSent: 0,
      absenceLimitUsersPushed: 0,
      streakRiskUsersPushed: 0,
      dueTodayUsersPushed: 0,
      moneyUsersPushed: 0,
      budgetUsersPushed: 0,
      almostThereUsersPushed: 0,
      anniversaryUsersPushed: 0,
      monthlyDigestSent: 0,
      expiredPadsDeleted: 0,
      staleSessionsDeleted: 0,
      sentNotificationsPurged: 0,
    });
  });

  it('retries next run when no channel reached the user', async () => {
    const prefs = {
      deadlineEmailReminders: false,
      deadlinePushReminders: true,
    };
    const { service, prisma } = setup([task('a', 'u1', prefs)], {
      pushDelivered: 0,
    });
    const result = await service.run(NOW);
    expect(prisma.sentReminder.createMany).not.toHaveBeenCalled();
    expect(result.remindersSent).toBe(0);
  });

  it('deletes expired and long-revoked device sessions on every run', async () => {
    const { service, prisma } = setup([]);
    prisma.userSession.deleteMany.mockResolvedValue({ count: 3 });
    const result = await service.run(NOW);
    expect(result.staleSessionsDeleted).toBe(3);
    expect(prisma.userSession.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { expiresAt: { lt: NOW } },
          {
            revokedAt: {
              lt: new Date(NOW.getTime() - REVOKED_SESSION_RETENTION_MS),
            },
          },
        ],
      },
    });
  });

  it('keeps going when the session cleanup fails', async () => {
    const { service, prisma } = setup([]);
    prisma.userSession.deleteMany.mockRejectedValue(new Error('db down'));
    const result = await service.run(NOW);
    expect(result.staleSessionsDeleted).toBe(0);
  });
});

// D-12: the deadline email uses the app language saved on the user's push
// subscription; without one it stays English.
describe('RemindersService two-phase work', () => {
  it('reminds of the hand-in and keeps the presentation for its own day', async () => {
    const prefs = {
      deadlineEmailReminders: false,
      deadlinePushReminders: true,
    };
    const twoPhase = {
      ...task('t1', 'u1', prefs),
      // Apresentacao daqui a 3 dias (fora da janela), entrega daqui a 2h.
      date: new Date('2026-10-22T12:00:00.000Z'),
      submissionDate: SOON,
    };
    const { service, prisma } = setup([twoPhase]);
    await service.run(NOW);
    expect(prisma.sentReminder.createMany).toHaveBeenCalledWith({
      data: [{ taskId: 't1', taskDate: SOON }],
      skipDuplicates: true,
    });
  });
});

describe('RemindersService email language', () => {
  const prefs = { deadlineEmailReminders: true, deadlinePushReminders: false };

  it('writes the email in the language of the push subscription', async () => {
    const t = task('a', 'u1', prefs);
    const withLang = {
      ...t,
      user: { ...t.user, pushSubscriptions: [{ lang: 'pt' }] },
    };
    const { service, mail } = setup([withLang]);
    await service.run(NOW);
    const [, items, , lang] = mail.sendDeadlineReminderEmail.mock.calls[0] as [
      string,
      { dueLabel: string }[],
      string,
      string,
    ];
    expect(lang).toBe('pt');
    expect(items[0].dueLabel).toBe('prazo daqui a cerca de 2h');
  });

  it('falls back to English without a subscription', async () => {
    const { service, mail } = setup([task('a', 'u1', prefs)]);
    await service.run(NOW);
    const [, items, , lang] = mail.sendDeadlineReminderEmail.mock.calls[0] as [
      string,
      { dueLabel: string }[],
      string,
      string,
    ];
    expect(lang).toBe('en');
    expect(items[0].dueLabel).toBe('due in about 2h');
  });
});
