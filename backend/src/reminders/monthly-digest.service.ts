import { Injectable, Logger } from '@nestjs/common';
import { ProgressStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { resolveMailLanguage } from '../mail/mail-messages';
import { getFrontendUrl } from '../config/app.config';
import { ACTIONABLE_DEADLINE_WHERE } from '../common/task-readiness.util';
import { roundTo } from '../common/round.util';
import { MS_PER_MINUTE } from '../common/time.constants';
import { getLisbonNow, toDateKey } from '../common/date-key.util';
import { lisbonWallClockToUtc } from '../calendar/feed/ics-feed.builder';
import {
  MONTH_KEY_LENGTH,
  MONTHLY_DIGEST_END_MINUTES,
  MONTHLY_DIGEST_MAX_SESSION_MINUTES,
  MONTHLY_DIGEST_PATH,
  MONTHLY_DIGEST_SEND_DAY_OF_MONTH,
  MONTHLY_DIGEST_START_MINUTES,
  MONTHLY_DIGEST_USER_BATCH_SIZE,
} from './monthly-digest.constants';
import { SentNotificationService } from './sent-notification.service';
import { SENT_NOTIFICATION_KIND } from './sent-notification.constants';

const MONTH_FIRST_DAY = '-01';
const KIND = SENT_NOTIFICATION_KIND.MONTHLY_DIGEST;

/** Dia 1 do mes, entre a hora de inicio e a de fim (Lisboa). */
export function isInMonthlyDigestWindow(
  today: Date,
  nowMinutes: number,
): boolean {
  return (
    today.getUTCDate() === MONTHLY_DIGEST_SEND_DAY_OF_MONTH &&
    nowMinutes >= MONTHLY_DIGEST_START_MINUTES &&
    nowMinutes < MONTHLY_DIGEST_END_MINUTES
  );
}

/** Chave "YYYY-MM" do mes anterior ao do dia dado (meia-noite UTC). */
export function previousMonthKey(today: Date): string {
  const first = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1),
  );
  return toDateKey(first).slice(0, MONTH_KEY_LENGTH);
}

interface CandidateUser {
  id: string;
  email: string;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
  pushSubscriptions: { lang: string | null }[];
}

interface UserDigest {
  completedCount: number;
  averageGrade: number | null;
  studyMinutes: number;
  overdueCount: number;
  topAreaName: string | null;
}

/**
 * Resumo mensal por email: um email por user e por mes, no dia 1 (Lisboa) a
 * partir de MONTHLY_DIGEST_START_HOUR, com o mes de calendario anterior
 * (tasks concluidas, minutos de estudo, nota media das tasks concluidas com
 * nota, tasks em atraso no fim do mes e a area mais estudada).
 *
 * - Preferencia: nao ha coluna de "resumo"/"revisao semanal" (a revisao
 *   semanal e so um endpoint, sem email), por isso reutiliza o unico opt-in
 *   de email que existe, deadlineEmailReminders. Sem coluna nova.
 * - So entra quem tem o email verificado (emailVerifiedAt) e nao esta banido;
 *   as horas de silencio sao respeitadas (tenta na execucao seguinte).
 * - Mes sem atividade (0 concluidas e 0 minutos de estudo) nao gera email.
 * - Queries em lote por pagina de users, sempre filtradas por userId.
 * - Dedupe duravel em SentNotification (periodo = mes resumido), sobrevive a
 *   restarts. O user e marcado ANTES do envio (execucoes sobrepostas nunca
 *   enviam duas vezes) e desmarcado se o SMTP falhar. Mes vazio tambem fica
 *   marcado (o mes passado ja nao muda).
 */
@Injectable()
export class MonthlyDigestService {
  private readonly logger = new Logger(MonthlyDigestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly sentNotifications: SentNotificationService,
  ) {}

  /** Utilizadores a quem o resumo foi enviado nesta execucao. */
  async sendDigests(): Promise<number> {
    const { today, nowMinutes } = getLisbonNow();
    if (!isInMonthlyDigestWindow(today, nowMinutes)) return 0;
    const month = previousMonthKey(today);

    let sent = 0;
    let cursor: string | undefined;
    for (;;) {
      // Pagina por `id > ultimo id` (ver DueTodayRemindersService).
      const users = await this.prisma.user.findMany({
        where: {
          status: { not: UserStatus.BANNED },
          deadlineEmailReminders: true,
          emailVerifiedAt: { not: null },
          ...(cursor ? { id: { gt: cursor } } : {}),
        },
        select: {
          id: true,
          email: true,
          quietHoursStart: true,
          quietHoursEnd: true,
          // Lingua da app (a das subscricoes push), para o email.
          pushSubscriptions: {
            select: { lang: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { id: 'asc' },
        take: MONTHLY_DIGEST_USER_BATCH_SIZE,
      });
      try {
        sent += await this.processPage(users, month, nowMinutes);
      } catch (err) {
        // Uma pagina que falha nao pode abortar as seguintes. Log so com o nome.
        this.logger.error(
          `Resumo mensal: falhou uma pagina (${
            err instanceof Error ? err.name : 'erro'
          })`,
        );
      }
      if (users.length < MONTHLY_DIGEST_USER_BATCH_SIZE) break;
      cursor = users[users.length - 1].id;
    }
    if (sent > 0) {
      this.logger.log(`Resumo mensal: ${sent} utilizadores`);
    }
    return sent;
  }

  private async processPage(
    users: CandidateUser[],
    month: string,
    nowMinutes: number,
  ): Promise<number> {
    const awake = users.filter((u) => !this.isQuietHour(u, nowMinutes));
    if (awake.length === 0) return 0;
    // 1 query: quem ja foi tratado neste mes (marcador duravel).
    const handled = await this.sentNotifications.claimedUserIds(
      awake.map((u) => u.id),
      KIND,
      month,
    );
    const pending = awake.filter((u) => !handled.has(u.id));
    if (pending.length === 0) return 0;

    const digests = await this.buildDigests(
      pending.map((u) => u.id),
      month,
    );
    const reviewLink = `${getFrontendUrl()}${MONTHLY_DIGEST_PATH}`;

    // Mes vazio: nada a contar, fica tratado (o mes passado ja nao muda).
    // 1 query para todos os vazios da pagina.
    const isEmpty = (digest: UserDigest | undefined) =>
      !digest || (digest.completedCount === 0 && digest.studyMinutes === 0);
    await this.sentNotifications.markMany(
      pending.filter((u) => isEmpty(digests.get(u.id))).map((u) => u.id),
      KIND,
      month,
    );

    let sent = 0;
    for (const user of pending) {
      const digest = digests.get(user.id);
      if (!digest || isEmpty(digest)) continue;
      // Marcado ANTES do envio: uma execucao sobreposta ja o salta.
      if (!(await this.sentNotifications.claim(user.id, KIND, month))) {
        continue;
      }
      let delivered = false;
      try {
        delivered = await this.mailService.sendMonthlyDigestEmail(
          user.email,
          { month, ...digest },
          reviewLink,
          resolveMailLanguage(user.pushSubscriptions[0]?.lang),
        );
      } finally {
        // SMTP falhou: desmarca, tenta na execucao seguinte.
        if (!delivered) {
          await this.sentNotifications.release(user.id, KIND, month);
        }
      }
      if (delivered) sent += 1;
    }
    return sent;
  }

  /** Numeros do mes para os users dados (o userId vai sempre no filtro). */
  private async buildDigests(
    userIds: string[],
    month: string,
  ): Promise<Map<string, UserDigest>> {
    const start = lisbonWallClockToUtc(`${month}${MONTH_FIRST_DAY}`, 0);
    const nextMonthFirst = new Date(`${month}${MONTH_FIRST_DAY}T00:00:00.000Z`);
    nextMonthFirst.setUTCMonth(nextMonthFirst.getUTCMonth() + 1);
    const end = lisbonWallClockToUtc(toDateKey(nextMonthFirst), 0);
    const inMonth = { gte: start, lt: end };
    const userFilter = { in: userIds };

    const [completed, overdue, sessions] = await Promise.all([
      this.prisma.task.groupBy({
        by: ['userId'],
        where: { userId: userFilter, completedAt: inMonth },
        _count: { _all: true },
        _avg: { realGrade: true },
      }),
      // Em atraso no fim do mes: prazo real antes do fim e ainda nao
      // concluida nesse instante (concluida depois tambem conta).
      this.prisma.task.groupBy({
        by: ['userId'],
        where: {
          userId: userFilter,
          date: { lt: end },
          ...ACTIONABLE_DEADLINE_WHERE,
          OR: [
            {
              completedAt: null,
              progressStatus: { not: ProgressStatus.COMPLETED },
            },
            { completedAt: { gte: end } },
          ],
        },
        _count: { _all: true },
      }),
      this.prisma.studySession.findMany({
        where: {
          userId: userFilter,
          startedAt: inMonth,
          endedAt: { not: null },
        },
        select: {
          userId: true,
          startedAt: true,
          endedAt: true,
          area: { select: { name: true } },
        },
      }),
    ]);

    const digests = new Map<string, UserDigest>();
    const digestOf = (userId: string): UserDigest => {
      let digest = digests.get(userId);
      if (!digest) {
        digest = {
          completedCount: 0,
          averageGrade: null,
          studyMinutes: 0,
          overdueCount: 0,
          topAreaName: null,
        };
        digests.set(userId, digest);
      }
      return digest;
    };

    for (const row of completed) {
      const digest = digestOf(row.userId);
      digest.completedCount = row._count._all;
      const avg = row._avg.realGrade;
      digest.averageGrade = avg === null ? null : roundTo(avg);
    }
    for (const row of overdue) {
      digestOf(row.userId).overdueCount = row._count._all;
    }

    const minutesByUser = new Map<string, number>();
    const areaMinutes = new Map<string, Map<string, number>>();
    for (const session of sessions) {
      const minutes = Math.min(
        MONTHLY_DIGEST_MAX_SESSION_MINUTES,
        Math.max(
          0,
          ((session.endedAt as Date).getTime() - session.startedAt.getTime()) /
            MS_PER_MINUTE,
        ),
      );
      minutesByUser.set(
        session.userId,
        (minutesByUser.get(session.userId) ?? 0) + minutes,
      );
      const areaName = session.area?.name;
      if (!areaName) continue;
      const byArea =
        areaMinutes.get(session.userId) ?? new Map<string, number>();
      byArea.set(areaName, (byArea.get(areaName) ?? 0) + minutes);
      areaMinutes.set(session.userId, byArea);
    }
    for (const [userId, minutes] of minutesByUser) {
      const digest = digestOf(userId);
      digest.studyMinutes = Math.round(minutes);
      let top: [string, number] | null = null;
      for (const entry of areaMinutes.get(userId) ?? []) {
        if (!top || entry[1] > top[1]) top = entry;
      }
      digest.topAreaName = top ? top[0] : null;
    }
    return digests;
  }

  private isQuietHour(user: CandidateUser, nowMinutes: number): boolean {
    const { quietHoursStart: start, quietHoursEnd: end } = user;
    if (start === null || end === null || start === end) return false;
    return start < end
      ? nowMinutes >= start && nowMinutes < end
      : nowMinutes >= start || nowMinutes < end;
  }
}
