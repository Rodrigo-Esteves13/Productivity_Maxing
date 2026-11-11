import { Injectable, Logger } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { getLisbonNow, toDateKey } from '../common/date-key.util';
import { MINUTES_PER_HOUR } from '../common/time.constants';
import { CourseRiskService } from '../course-risk/course-risk.service';
import type { CourseRiskOverviewRow } from '../course-risk/course-risk-overview.types';
import { SentNotificationService } from './sent-notification.service';
import { SENT_NOTIFICATION_KIND } from './sent-notification.constants';

const KIND = SENT_NOTIFICATION_KIND.GRADE_ALMOST_THERE;

const GRADES_PATH = '/course-risk';
// Peso ja avaliado a partir do qual a cadeira conta como "quase la"
// (ainda faltam avaliar no maximo 100 - este valor %).
export const ALMOST_THERE_FROM_PCT = 85;
const FULL_WEIGHT_PCT = 100;
// Janela diaria (hora de Lisboa): nunca acorda ninguem de madrugada.
const SEND_WINDOW_START_MINUTES = 9 * MINUTES_PER_HOUR;
const SEND_WINDOW_END_MINUTES = 21 * MINUTES_PER_HOUR;
// Utilizadores processados por pagina (cursor por id, ordem estavel).
export const USER_BATCH_SIZE = 200;

/** Cadeiras avaliadas com 85% a menos de 100% do peso ja avaliado. */
export function almostThereRows(
  rows: readonly CourseRiskOverviewRow[],
): CourseRiskOverviewRow[] {
  return rows.filter(
    (row) =>
      row.status === 'assessed' &&
      row.gradedWeightPct >= ALMOST_THERE_FROM_PCT &&
      row.gradedWeightPct < FULL_WEIGHT_PCT,
  );
}

/**
 * Aviso "quase la": uma cadeira ja tem quase todo o peso avaliado. Um push
 * por cadeira (periodo do marcador = areaId), com o peso que falta. O marcador
 * duravel e apagado pela limpeza dos 62 dias; se a cadeira continuar quase
 * completa nessa altura o aviso pode voltar uma vez.
 *
 * O calculo de risco e pesado, por isso cada user e avaliado no maximo uma vez
 * por dia (memo em memoria, so uma otimizacao).
 */
@Injectable()
export class GradeAlmostThereRemindersService {
  private readonly logger = new Logger(GradeAlmostThereRemindersService.name);
  // userId -> dia (YYYY-MM-DD, Lisboa) em que foi avaliado.
  private readonly evaluated = new Map<string, string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushService: PushService,
    private readonly courseRisk: CourseRiskService,
    private readonly sentNotifications: SentNotificationService,
  ) {}

  async sendReminders(): Promise<number> {
    const { today, nowMinutes } = getLisbonNow();
    if (
      nowMinutes < SEND_WINDOW_START_MINUTES ||
      nowMinutes >= SEND_WINDOW_END_MINUTES
    ) {
      return 0;
    }
    const dayKey = toDateKey(today);
    for (const [userId, day] of this.evaluated) {
      if (day !== dayKey) this.evaluated.delete(userId);
    }

    let sent = 0;
    let cursor: string | undefined;
    for (;;) {
      const users = await this.prisma.user.findMany({
        where: {
          status: { not: UserStatus.BANNED },
          pushSubscriptions: { some: {} },
          ...(cursor ? { id: { gt: cursor } } : {}),
        },
        select: { id: true, quietHoursStart: true, quietHoursEnd: true },
        orderBy: { id: 'asc' },
        take: USER_BATCH_SIZE,
      });
      for (const user of users) {
        if (this.evaluated.get(user.id) === dayKey) continue;
        if (this.isQuietHour(user, nowMinutes)) continue;
        // Um user que falha nao pode abortar a corrida dos seguintes.
        try {
          this.evaluated.set(user.id, dayKey);
          sent += await this.processUser(user.id);
        } catch (err) {
          this.logger.error(
            `Quase la: falhou o utilizador ${user.id} (${
              err instanceof Error ? err.name : 'erro'
            })`,
          );
        }
      }
      if (users.length < USER_BATCH_SIZE) break;
      cursor = users[users.length - 1].id;
    }
    if (sent > 0) this.logger.log(`Quase la: ${sent} avisos enviados`);
    return sent;
  }

  /** Devolve 1 se algum aviso chegou ao user (um push por cadeira nova). */
  private async processUser(userId: string): Promise<number> {
    const overview = await this.courseRisk.overview(userId);
    let delivered = 0;
    for (const row of almostThereRows(overview.courses)) {
      // Marcado ANTES do envio: uma execucao sobreposta ja o salta.
      if (!(await this.sentNotifications.claim(userId, KIND, row.areaId))) {
        continue;
      }
      let reached = 0;
      try {
        reached = await this.pushService.notifyUser(
          userId,
          'gradeAlmostThere',
          {
            title: row.areaName,
            count: Math.round(FULL_WEIGHT_PCT - row.gradedWeightPct),
            url: GRADES_PATH,
          },
        );
      } finally {
        if (reached === 0) {
          await this.sentNotifications.release(userId, KIND, row.areaId);
        }
      }
      delivered += reached > 0 ? 1 : 0;
    }
    return delivered > 0 ? 1 : 0;
  }

  private isQuietHour(
    user: { quietHoursStart: number | null; quietHoursEnd: number | null },
    nowMinutes: number,
  ): boolean {
    const { quietHoursStart: start, quietHoursEnd: end } = user;
    if (start === null || end === null || start === end) return false;
    return start < end
      ? nowMinutes >= start && nowMinutes < end
      : nowMinutes >= start || nowMinutes < end;
  }
}
