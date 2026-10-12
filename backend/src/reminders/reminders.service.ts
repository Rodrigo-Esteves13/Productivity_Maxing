import { Injectable, Logger } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { getFrontendUrl } from '../config/app.config';
import { getLisbonNow, toDateKey } from '../common/date-key.util';
import { lisbonWallClockToUtc } from '../calendar/feed/ics-feed.builder';

const HOUR_MS = 3_600_000;
// Task com hora: avisa 24h antes. Task só com dia: avisa na manhã do dia
// anterior (09:00, hora de Lisboa) - "24h antes de meia-noite" seria às 00h.
const TIMED_LEAD_MS = 24 * HOUR_MS;
const DATE_ONLY_REMINDER_MINUTES = 9 * 60;
// Só olha para o futuro próximo (o lembrete mais cedo é a manhã antes).
const LOOKAHEAD_MS = 72 * HOUR_MS;
const MAX_TASKS_PER_RUN = 1000;

export interface ReminderRunResult {
  usersEmailed: number;
  remindersSent: number;
}

// Corre por pedido do cron (ver RemindersController) - sem agendador dentro
// da app (o Render pode adormecer/duplicar instâncias; um Cron Job externo
// a chamar o endpoint de hora a hora é mais fiável e não precisa de deps).
@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async run(now = new Date()): Promise<ReminderRunResult> {
    const tasks = await this.prisma.task.findMany({
      where: {
        progressStatus: { not: 'COMPLETED' },
        date: { gt: now, lte: new Date(now.getTime() + LOOKAHEAD_MS) },
        user: {
          deadlineEmailReminders: true,
          status: { not: UserStatus.BANNED },
        },
      },
      select: {
        id: true,
        title: true,
        date: true,
        userId: true,
        area: { select: { name: true } },
        user: {
          select: { email: true, quietHoursStart: true, quietHoursEnd: true },
        },
        sentReminders: { select: { taskDate: true } },
      },
      orderBy: { date: 'asc' },
      take: MAX_TASKS_PER_RUN,
    });

    const nowMinutes = getLisbonNow().nowMinutes;
    const byUser = new Map<string, typeof tasks>();

    for (const task of tasks) {
      const dateMs = task.date.getTime();
      const alreadySent = task.sentReminders.some(
        (r) => r.taskDate.getTime() === dateMs,
      );
      if (alreadySent) continue;
      if (this.remindAt(task.date).getTime() > now.getTime()) continue;
      if (this.isQuietHour(task.user, nowMinutes)) continue;

      const list = byUser.get(task.userId) ?? [];
      list.push(task);
      byUser.set(task.userId, list);
    }

    const result: ReminderRunResult = { usersEmailed: 0, remindersSent: 0 };
    const tasksLink = `${getFrontendUrl()}/tasks`;

    for (const [, userTasks] of byUser) {
      const accepted = await this.mailService.sendDeadlineReminderEmail(
        userTasks[0].user.email,
        userTasks.map((t) => ({
          title: t.title,
          areaName: t.area?.name ?? null,
          dueLabel: this.dueLabel(t.date, now),
        })),
        tasksLink,
      );
      if (!accepted) continue; // volta a tentar na próxima execução

      await this.prisma.sentReminder.createMany({
        data: userTasks.map((t) => ({ taskId: t.id, taskDate: t.date })),
        skipDuplicates: true,
      });
      result.usersEmailed += 1;
      result.remindersSent += userTasks.length;
    }

    this.logger.log(
      `Lembretes: ${result.remindersSent} tasks, ${result.usersEmailed} utilizadores`,
    );
    return result;
  }

  private isDateOnly(date: Date): boolean {
    return (
      date.getUTCHours() === 0 &&
      date.getUTCMinutes() === 0 &&
      date.getUTCSeconds() === 0
    );
  }

  /** Instante a partir do qual o lembrete pode sair. */
  private remindAt(date: Date): Date {
    if (!this.isDateOnly(date)) return new Date(date.getTime() - TIMED_LEAD_MS);
    const dayBefore = new Date(date.getTime() - 24 * HOUR_MS);
    return lisbonWallClockToUtc(toDateKey(dayBefore), DATE_ONLY_REMINDER_MINUTES);
  }

  private dueLabel(date: Date, now: Date): string {
    if (this.isDateOnly(date)) {
      return `due ${new Intl.DateTimeFormat('en-GB', {
        timeZone: 'UTC',
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      }).format(date)}`;
    }
    const hours = Math.max(1, Math.round((date.getTime() - now.getTime()) / HOUR_MS));
    return `due in about ${hours}h`;
  }

  private isQuietHour(
    user: { quietHoursStart: number | null; quietHoursEnd: number | null },
    nowMinutes: number,
  ): boolean {
    const { quietHoursStart: start, quietHoursEnd: end } = user;
    // Só valem os dois juntos (ver comentário no schema).
    if (start === null || end === null || start === end) return false;
    return start < end
      ? nowMinutes >= start && nowMinutes < end
      : nowMinutes >= start || nowMinutes < end; // janela que passa a meia-noite
  }
}
