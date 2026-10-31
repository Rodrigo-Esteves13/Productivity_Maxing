import { FIRM_DATE_WHERE } from '../common/task-readiness.util';
import { Injectable, Logger } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { PushService } from '../push/push.service';
import { PadsService } from '../pads/pads.service';
import { MedicationsService } from '../wellbeing/medications.service';
import { PersonalNotesService } from '../personal-notes/personal-notes.service';
import { AbsenceLimitRemindersService } from './absence-limit-reminders.service';
import { getFrontendUrl } from '../config/app.config';
import { deleteStaleUserSessions } from '../auth/services/user-sessions.service';
import { getLisbonNow, toDateKey } from '../common/date-key.util';
import { lisbonWallClockToUtc } from '../calendar/feed/ics-feed.builder';
import {
  deadlineEmailText,
  fillMailTemplate,
  MAIL_DATE_LOCALE,
  resolveMailLanguage,
} from '../mail/mail-messages';

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
  usersPushed: number;
  remindersSent: number;
  // Utilizadores avisados de tomas de medicacao nesta execucao.
  medicationUsersPushed: number;
  // Lembretes de notas pessoais enviados nesta execucao.
  personalRemindersSent: number;
  // Utilizadores avisados de que estao perto do limite de faltas (semanal).
  absenceLimitUsersPushed: number;
  expiredPadsDeleted: number;
  // Sessoes de dispositivo expiradas/revogadas apagadas nesta execucao.
  staleSessionsDeleted: number;
}

// Um aviso push por user e por execucao: a primeira task (a mais proxima)
// no texto e "e mais N" para as restantes.
const PUSH_KEY_BY_GROUP_SIZE = (count: number) =>
  count === 1 ? 'deadlineSoon' : 'deadlinesSoon';
const TASKS_PATH = '/tasks';

// Corre por pedido do cron (ver RemindersController) - sem agendador dentro
// da app (o Render pode adormecer/duplicar instâncias; um Cron Job externo
// a chamar o endpoint de hora a hora é mais fiável e não precisa de deps).
@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly pushService: PushService,
    private readonly medicationsService: MedicationsService,
    private readonly padsService: PadsService,
    private readonly personalNotesService: PersonalNotesService,
    private readonly absenceLimitReminders: AbsenceLimitRemindersService,
  ) {}

  async run(now = new Date()): Promise<ReminderRunResult> {
    const window = { gt: now, lte: new Date(now.getTime() + LOOKAHEAD_MS) };
    const tasks = await this.prisma.task.findMany({
      where: {
        progressStatus: { not: 'COMPLETED' },
        // A entrega de um trabalho em duas fases tambem tem lembrete.
        OR: [{ date: window }, { submissionDate: window }],
        // Data por marcar/surpresa e so um palpite: "falta 1 dia" mentia.
        ...FIRM_DATE_WHERE,
        user: {
          OR: [
            { deadlineEmailReminders: true },
            { deadlinePushReminders: true },
          ],
          status: { not: UserStatus.BANNED },
        },
      },
      select: {
        id: true,
        title: true,
        date: true,
        submissionDate: true,
        userId: true,
        area: { select: { name: true } },
        user: {
          select: {
            email: true,
            quietHoursStart: true,
            quietHoursEnd: true,
            deadlineEmailReminders: true,
            deadlinePushReminders: true,
            // Lingua da app (a das subscricoes push), para o email.
            pushSubscriptions: {
              select: { lang: true },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
        sentReminders: { select: { taskDate: true } },
      },
      orderBy: { date: 'asc' },
      take: MAX_TASKS_PER_RUN,
    });

    const nowMinutes = getLisbonNow().nowMinutes;
    // Um lembrete por prazo: a apresentacao (`date`) e, num trabalho em duas
    // fases, a entrega. SentReminder e por [task, dia], por isso os dois
    // saem cada um no seu dia sem se pisarem.
    const inWindow = (d: Date | null): d is Date =>
      d !== null && d > window.gt && d <= window.lte;
    const dues = tasks.flatMap((task) =>
      [task.date, task.submissionDate]
        .filter(inWindow)
        .map((due) => ({ ...task, due })),
    );
    const byUser = new Map<string, typeof dues>();

    for (const task of dues) {
      const dateMs = task.due.getTime();
      const alreadySent = task.sentReminders.some(
        (r) => r.taskDate.getTime() === dateMs,
      );
      if (alreadySent) continue;
      if (this.remindAt(task.due).getTime() > now.getTime()) continue;
      if (this.isQuietHour(task.user, nowMinutes)) continue;

      const list = byUser.get(task.userId) ?? [];
      list.push(task);
      byUser.set(task.userId, list);
    }

    const result: ReminderRunResult = {
      usersEmailed: 0,
      usersPushed: 0,
      remindersSent: 0,
      medicationUsersPushed: 0,
      personalRemindersSent: 0,
      absenceLimitUsersPushed: 0,
      expiredPadsDeleted: 0,
      staleSessionsDeleted: 0,
    };
    const tasksLink = `${getFrontendUrl()}${TASKS_PATH}`;

    for (const [userId, userTasks] of byUser) {
      const { user } = userTasks[0];
      const lang = resolveMailLanguage((user.pushSubscriptions ?? [])[0]?.lang);
      const emailed =
        user.deadlineEmailReminders &&
        (await this.mailService.sendDeadlineReminderEmail(
          user.email,
          userTasks.map((t) => ({
            title: t.title,
            areaName: t.area?.name ?? null,
            dueLabel: this.dueLabel(t.due, now, lang),
          })),
          tasksLink,
          lang,
        ));
      const pushed =
        user.deadlinePushReminders &&
        (await this.pushService.notifyUser(
          userId,
          PUSH_KEY_BY_GROUP_SIZE(userTasks.length),
          {
            title: userTasks[0].title,
            count: userTasks.length - 1,
            url: TASKS_PATH,
          },
        )) > 0;
      if (emailed) result.usersEmailed += 1;
      if (pushed) result.usersPushed += 1;
      // Basta um canal ter chegado ao user para nao repetir o lembrete.
      // Se nenhum chegou (SMTP em baixo, sem dispositivos), tenta outra vez
      // na proxima execucao.
      if (!emailed && !pushed) continue;

      await this.prisma.sentReminder.createMany({
        data: userTasks.map((t) => ({ taskId: t.id, taskDate: t.due })),
        skipDuplicates: true,
      });
      result.remindersSent += userTasks.length;
    }

    // Falha nos lembretes de medicacao nao pode travar os de prazos (e
    // vice-versa: estes ja correram).
    try {
      result.medicationUsersPushed =
        await this.medicationsService.sendDueReminders();
    } catch (error) {
      this.logger.warn(
        `Lembretes de medicacao falharam: ${(error as Error).message}`,
      );
    }

    try {
      result.personalRemindersSent =
        await this.personalNotesService.sendDueReminders(now);
    } catch (error) {
      this.logger.warn(
        `Lembretes pessoais falharam: ${(error as Error).message}`,
      );
    }

    try {
      result.absenceLimitUsersPushed =
        await this.absenceLimitReminders.sendWeeklyReminders();
    } catch (error) {
      this.logger.warn(
        `Aviso de limite de faltas falhou: ${(error as Error).message}`,
      );
    }

    // Limpeza dos pads sem edicoes ha 90 dias; falhar aqui nao para os
    // lembretes (ja enviados acima).
    try {
      result.expiredPadsDeleted = await this.padsService.deleteExpired(now);
    } catch (error) {
      this.logger.warn(
        `Limpeza de pads expirados falhou: ${(error as Error).message}`,
      );
    }

    // Sessoes de dispositivo com o refresh expirado ou revogadas ha dias
    // (ver deleteStaleUserSessions): a tabela nao cresce para sempre.
    try {
      result.staleSessionsDeleted = await deleteStaleUserSessions(
        this.prisma,
        now,
      );
    } catch (error) {
      this.logger.warn(
        `Limpeza de sessoes expiradas falhou: ${(error as Error).message}`,
      );
    }

    this.logger.log(
      `Lembretes: ${result.remindersSent} tasks, ${result.usersEmailed} por email, ${result.usersPushed} por push`,
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
    return lisbonWallClockToUtc(
      toDateKey(dayBefore),
      DATE_ONLY_REMINDER_MINUTES,
    );
  }

  private dueLabel(date: Date, now: Date, lang = 'en'): string {
    const text = deadlineEmailText(lang);
    if (this.isDateOnly(date)) {
      const formatted = new Intl.DateTimeFormat(
        MAIL_DATE_LOCALE[resolveMailLanguage(lang)],
        { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' },
      ).format(date);
      return fillMailTemplate(text.dueOn, { date: formatted });
    }
    const hours = Math.max(
      1,
      Math.round((date.getTime() - now.getTime()) / HOUR_MS),
    );
    return fillMailTemplate(text.dueInHours, { hours });
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
