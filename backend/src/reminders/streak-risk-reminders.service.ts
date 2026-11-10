import { Injectable, Logger } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import {
  getLisbonNow,
  lisbonDayBounds,
  toDateKey,
  toLisbonDateKey,
} from '../common/date-key.util';
import { MINUTES_PER_HOUR } from '../common/time.constants';
import { walkStreak } from '../study-sessions/study-streak.util';
import { SentNotificationService } from './sent-notification.service';
import { SENT_NOTIFICATION_KIND } from './sent-notification.constants';

const KIND = SENT_NOTIFICATION_KIND.STREAK_RISK;

// So avisa quem ja tem uma sequencia que vale a pena salvar.
export const STREAK_RISK_MIN_DAYS = 3;
// Janela de envio (hora de Lisboa): noite, ainda a tempo de estudar antes da
// meia-noite. O cron externo corre de 15 em 15 min
// (docs/adr/0006-external-cron-for-reminders.md), por isso ha varias
// execucoes dentro da janela e um envio falhado volta a tentar.
export const STREAK_RISK_WINDOW_START_MINUTES = 20 * MINUTES_PER_HOUR;
export const STREAK_RISK_WINDOW_END_MINUTES = 22 * MINUTES_PER_HOUR;
// Utilizadores processados por pagina (cursor por id, ordem estavel).
export const STREAK_RISK_USER_BATCH_SIZE = 500;
const STUDY_PATH = '/focus';

/** 20:00-22:00 em Lisboa (`nowMinutes` = minutos desde a meia-noite). */
export function isInStreakRiskWindow(nowMinutes: number): boolean {
  return (
    nowMinutes >= STREAK_RISK_WINDOW_START_MINUTES &&
    nowMinutes < STREAK_RISK_WINDOW_END_MINUTES
  );
}

interface CandidateUser {
  id: string;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
}

/**
 * Aviso "a tua streak esta em risco": um unico push por user e por dia de
 * Lisboa, ao fim da tarde/noite, a quem tem streak de estudo >= minimo e
 * ainda nao estudou hoje (nem sessao terminada nem sessao a decorrer). Tasks
 * concluidas nao contam: a streak e so de sessoes de estudo.
 *
 * - A streak vem de walkStreak (a mesma do GET /study-sessions/streak). Hoje
 *   nunca e "falha"; se ha um freeze guardado, falhar hoje gasta o freeze e a
 *   streak sobrevive, por isso NAO e risco e nao se avisa.
 * - Quem pediu dia de descanso para hoje (StreakFreeze) nao e avisado; os
 *   dias de descanso passados fazem ponte na streak.
 * - Quem desligou as notificacoes (sem dispositivos push) nem entra na query;
 *   as horas de silencio do user sao respeitadas.
 * - Dedupe diario duravel em SentNotification (sobrevive a restarts). So
 *   fica marcado quando algum dispositivo recebeu.
 * - Quem nao precisa de aviso hoje (ja estudou, ou streak curta) e memorizado
 *   por dia (so em memoria: e uma otimizacao, nao o dedupe) e saltado nas
 *   execucoes seguintes, sem refazer as queries.
 */
@Injectable()
export class StreakRiskRemindersService {
  private readonly logger = new Logger(StreakRiskRemindersService.name);
  // userId -> dia em que ficou provado que nao ha nada a avisar.
  private readonly settledDay = new Map<string, string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushService: PushService,
    private readonly sentNotifications: SentNotificationService,
  ) {}

  // O relogio vem de getLisbonNow() (hora de Lisboa).
  async sendReminders(): Promise<number> {
    const { today, nowMinutes } = getLisbonNow();
    if (!isInStreakRiskWindow(nowMinutes)) return 0;
    const dayKey = toDateKey(today);
    // Dia novo: esquece os anteriores (o mapa nao cresce sem fim).
    for (const [userId, day] of this.settledDay) {
      if (day !== dayKey) this.settledDay.delete(userId);
    }

    let sent = 0;
    let cursor: string | undefined;
    for (;;) {
      // Pagina por `id > ultimo id` (ver AbsenceLimitRemindersService).
      const users = await this.prisma.user.findMany({
        where: {
          status: { not: UserStatus.BANNED },
          pushSubscriptions: { some: {} },
          ...(cursor ? { id: { gt: cursor } } : {}),
        },
        select: { id: true, quietHoursStart: true, quietHoursEnd: true },
        orderBy: { id: 'asc' },
        take: STREAK_RISK_USER_BATCH_SIZE,
      });
      try {
        sent += await this.processPage(users, dayKey, nowMinutes);
      } catch (err) {
        // Uma pagina que falha nao pode abortar as seguintes. Log so com o nome.
        this.logger.error(
          `Streak em risco: falhou uma pagina (${
            err instanceof Error ? err.name : 'erro'
          })`,
        );
      }
      if (users.length < STREAK_RISK_USER_BATCH_SIZE) break;
      cursor = users[users.length - 1].id;
    }
    if (sent > 0) {
      this.logger.log(`Streak em risco: ${sent} utilizadores avisados`);
    }
    return sent;
  }

  private async processPage(
    users: CandidateUser[],
    dayKey: string,
    nowMinutes: number,
  ): Promise<number> {
    const unsettled = users.filter(
      (u) =>
        this.settledDay.get(u.id) !== dayKey &&
        !this.isQuietHour(u, nowMinutes),
    );
    if (unsettled.length === 0) return 0;
    // 1 query: quem ja foi avisado hoje (marcador duravel).
    const notified = await this.sentNotifications.claimedUserIds(
      unsettled.map((u) => u.id),
      KIND,
      dayKey,
    );
    const pending = unsettled.filter((u) => !notified.has(u.id));
    if (pending.length === 0) return 0;

    // Passo 1 (1 query para a pagina toda): quem ja estudou hoje. So conta
    // sessao de estudo, como a streak (getStreak/walkStreak): uma task
    // concluida nao salva a streak, por isso nao cancela o aviso.
    // - sessao terminada hoje: a streak esta salva, fica resolvido no dia;
    // - sessao a decorrer (endedAt null, comecou hoje): esta a estudar agora,
    //   nao se avisa nesta execucao, mas nao fica resolvido (pode descartar
    //   a sessao e a streak volta a estar em risco).
    const { start, end } = lisbonDayBounds(dayKey);
    const ids = pending.map((u) => u.id);
    const sessionsToday = await this.prisma.studySession.findMany({
      where: {
        userId: { in: ids },
        startedAt: { gte: start, lt: end },
      },
      select: { userId: true, endedAt: true },
    });
    const studyingToday = new Set<string>();
    for (const row of sessionsToday) {
      studyingToday.add(row.userId);
      if (row.endedAt !== null) this.settledDay.set(row.userId, dayKey);
    }
    const idle = pending.filter((u) => !studyingToday.has(u.id));
    if (idle.length === 0) return 0;

    // Passo 2 (1 query): dias de descanso pedidos (StreakFreeze). Quem
    // descansa hoje nao esta em risco: fica resolvido no dia. Os outros dias
    // de descanso entram no calculo da streak (fazem ponte).
    const freezes = await this.prisma.streakFreeze.findMany({
      where: { userId: { in: idle.map((u) => u.id) } },
      select: { userId: true, dateKey: true },
    });
    const frozenByUser = new Map<string, Set<string>>();
    for (const row of freezes) {
      let days = frozenByUser.get(row.userId);
      if (!days) {
        days = new Set();
        frozenByUser.set(row.userId, days);
      }
      days.add(row.dateKey);
    }
    const restless = idle.filter((u) => {
      if (!frozenByUser.get(u.id)?.has(dayKey)) return true;
      this.settledDay.set(u.id, dayKey);
      return false;
    });
    if (restless.length === 0) return 0;

    // Passo 3 (1 query): historico dos restantes, para calcular a streak.
    const history = await this.prisma.studySession.findMany({
      where: {
        userId: { in: restless.map((u) => u.id) },
        endedAt: { not: null },
      },
      select: { userId: true, startedAt: true },
    });
    const daysByUser = new Map<string, Set<string>>();
    const firstDayByUser = new Map<string, string>();
    for (const row of history) {
      const key = toLisbonDateKey(row.startedAt);
      let days = daysByUser.get(row.userId);
      if (!days) {
        days = new Set();
        daysByUser.set(row.userId, days);
      }
      days.add(key);
      // Chaves ISO ordenam como texto: o primeiro dia e o menor.
      const first = firstDayByUser.get(row.userId);
      if (first === undefined || key < first) {
        firstDayByUser.set(row.userId, key);
      }
    }

    let sent = 0;
    for (const user of restless) {
      const days = daysByUser.get(user.id);
      const firstDay = firstDayByUser.get(user.id);
      const streak =
        days && firstDay
          ? walkStreak(days, firstDay, dayKey, frozenByUser.get(user.id))
          : null;
      // Com freeze guardado, falhar hoje nao parte a streak: nao e risco.
      const atRisk =
        streak !== null &&
        streak.currentStreak >= STREAK_RISK_MIN_DAYS &&
        streak.freezesAvailable === 0;
      if (!atRisk) {
        this.settledDay.set(user.id, dayKey);
        continue;
      }
      // Marcado ANTES do envio: uma execucao sobreposta ja o salta.
      if (!(await this.sentNotifications.claim(user.id, KIND, dayKey))) {
        continue;
      }
      let delivered = 0;
      try {
        delivered = await this.pushService.notifyUser(user.id, 'streakRisk', {
          count: streak.currentStreak,
          url: STUDY_PATH,
        });
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
