import { Injectable, Logger } from '@nestjs/common';
import { ProgressStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { ACTIONABLE_DEADLINE_WHERE } from '../common/task-readiness.util';
import {
  getLisbonNow,
  lisbonDayBounds,
  toDateKey,
} from '../common/date-key.util';
import {
  DUE_TODAY_DIGEST_END_MINUTES,
  DUE_TODAY_DIGEST_PATH,
  DUE_TODAY_DIGEST_START_MINUTES,
  DUE_TODAY_DIGEST_USER_BATCH_SIZE,
} from './due-today-reminders.constants';
import { SentNotificationService } from './sent-notification.service';
import { SENT_NOTIFICATION_KIND } from './sent-notification.constants';

const KIND = SENT_NOTIFICATION_KIND.DUE_TODAY_DIGEST;

/** 08:00-12:00 em Lisboa (`nowMinutes` = minutos desde a meia-noite). */
export function isInDueTodayDigestWindow(nowMinutes: number): boolean {
  return (
    nowMinutes >= DUE_TODAY_DIGEST_START_MINUTES &&
    nowMinutes < DUE_TODAY_DIGEST_END_MINUTES
  );
}

interface CandidateUser {
  id: string;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
}

/**
 * Resumo da manha: um unico push por user e por dia de Lisboa, "N tasks para
 * hoje", sem titulos nem nomes de cadeiras (o ecra de bloqueio e publico).
 * Conta as tasks pendentes (nao concluidas) com prazo firme hoje, seja a data
 * (apresentacao) ou a entrega (submissionDate).
 *
 * - So entra quem tem dispositivos push e ligou os avisos de prazos
 *   (deadlinePushReminders, o mesmo interruptor do lembrete "falta 1 dia");
 *   as horas de silencio do user sao respeitadas.
 * - Tasks bloqueadas ou com data por marcar/surpresa nao contam (so prazos
 *   reais que da para cumprir, como o "Hoje").
 * - Dedupe diario duravel em SentNotification (sobrevive a restarts). So
 *   fica marcado quando algum dispositivo recebeu.
 * - Quem tem 0 tasks hoje nao e marcado: uma task criada mais tarde, ainda
 *   dentro da janela, passa a contar na execucao seguinte.
 */
@Injectable()
export class DueTodayRemindersService {
  private readonly logger = new Logger(DueTodayRemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushService: PushService,
    private readonly sentNotifications: SentNotificationService,
  ) {}

  // O relogio vem de getLisbonNow() (hora de Lisboa).
  async sendReminders(): Promise<number> {
    const { today, nowMinutes } = getLisbonNow();
    if (!isInDueTodayDigestWindow(nowMinutes)) return 0;
    const dayKey = toDateKey(today);

    let sent = 0;
    let cursor: string | undefined;
    for (;;) {
      // Pagina por `id > ultimo id` (ver AbsenceLimitRemindersService).
      const users = await this.prisma.user.findMany({
        where: {
          status: { not: UserStatus.BANNED },
          deadlinePushReminders: true,
          pushSubscriptions: { some: {} },
          ...(cursor ? { id: { gt: cursor } } : {}),
        },
        select: { id: true, quietHoursStart: true, quietHoursEnd: true },
        orderBy: { id: 'asc' },
        take: DUE_TODAY_DIGEST_USER_BATCH_SIZE,
      });
      try {
        sent += await this.processPage(users, dayKey, nowMinutes);
      } catch (err) {
        // Uma pagina que falha nao pode abortar as seguintes. Log so com o nome.
        this.logger.error(
          `Resumo do dia: falhou uma pagina (${
            err instanceof Error ? err.name : 'erro'
          })`,
        );
      }
      if (users.length < DUE_TODAY_DIGEST_USER_BATCH_SIZE) break;
      cursor = users[users.length - 1].id;
    }
    if (sent > 0) {
      this.logger.log(`Resumo do dia: ${sent} utilizadores avisados`);
    }
    return sent;
  }

  private async processPage(
    users: CandidateUser[],
    dayKey: string,
    nowMinutes: number,
  ): Promise<number> {
    const awake = users.filter((u) => !this.isQuietHour(u, nowMinutes));
    if (awake.length === 0) return 0;
    // 1 query: quem ja foi avisado hoje (marcador duravel).
    const notified = await this.sentNotifications.claimedUserIds(
      awake.map((u) => u.id),
      KIND,
      dayKey,
    );
    const pending = awake.filter((u) => !notified.has(u.id));
    if (pending.length === 0) return 0;

    // 1 query para a pagina toda: quantas tasks pendentes vencem hoje, por
    // user. O userId vai sempre no filtro (so tasks do proprio user).
    const { start, end } = lisbonDayBounds(dayKey);
    const todayWindow = { gte: start, lt: end };
    const rows = await this.prisma.task.groupBy({
      by: ['userId'],
      where: {
        userId: { in: pending.map((u) => u.id) },
        progressStatus: { not: ProgressStatus.COMPLETED },
        completedAt: null,
        ...ACTIONABLE_DEADLINE_WHERE,
        OR: [{ date: todayWindow }, { submissionDate: todayWindow }],
      },
      _count: { _all: true },
    });
    const countByUser = new Map(rows.map((r) => [r.userId, r._count._all]));

    let sent = 0;
    for (const user of pending) {
      const count = countByUser.get(user.id) ?? 0;
      if (count === 0) continue;
      // Marcado ANTES do envio: uma execucao sobreposta ja o salta.
      if (!(await this.sentNotifications.claim(user.id, KIND, dayKey))) {
        continue;
      }
      let delivered = 0;
      try {
        delivered = await this.pushService.notifyUser(
          user.id,
          'dueTodayDigest',
          { count, url: DUE_TODAY_DIGEST_PATH },
        );
      } finally {
        // Sem dispositivo que tenha recebido: desmarca, tenta na proxima.
        if (delivered === 0) {
          await this.sentNotifications.release(user.id, KIND, dayKey);
        }
      }
      if (delivered > 0) sent += 1;
    }
    return sent;
  }

  private isQuietHour(user: CandidateUser, nowMinutes: number): boolean {
    const { quietHoursStart: start, quietHoursEnd: end } = user;
    if (start === null || end === null || start === end) return false;
    return start < end
      ? nowMinutes >= start && nowMinutes < end
      : nowMinutes >= start || nowMinutes < end;
  }
}
