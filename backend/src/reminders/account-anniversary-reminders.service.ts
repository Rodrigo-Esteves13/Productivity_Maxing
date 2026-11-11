import { Injectable, Logger } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { getLisbonNow, toDateKey } from '../common/date-key.util';
import { MINUTES_PER_HOUR } from '../common/time.constants';
import { SentNotificationService } from './sent-notification.service';
import { SENT_NOTIFICATION_KIND } from './sent-notification.constants';

const KIND = SENT_NOTIFICATION_KIND.ACCOUNT_ANNIVERSARY;

const HOME_PATH = '/';
const MONTHS_PER_YEAR = 12;
// Marcos em meses; depois disso, a cada ano completo.
export const ANNIVERSARY_MONTHS: readonly number[] = [1, 3, 6];
const SEND_WINDOW_START_MINUTES = 10 * MINUTES_PER_HOUR;
const SEND_WINDOW_END_MINUTES = 20 * MINUTES_PER_HOUR;
export const USER_BATCH_SIZE = 500;

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * Meses completos desde `createdAt` se `today` (meia-noite UTC do dia de
 * Lisboa) e o dia do aniversario mensal (dia 31 num mes curto cai no ultimo
 * dia) e um marco; senao null.
 */
export function anniversaryMonths(createdAt: Date, today: Date): number | null {
  const months =
    (today.getUTCFullYear() - createdAt.getUTCFullYear()) * MONTHS_PER_YEAR +
    (today.getUTCMonth() - createdAt.getUTCMonth());
  if (months < 1) return null;
  const targetDay = Math.min(
    createdAt.getUTCDate(),
    daysInMonth(today.getUTCFullYear(), today.getUTCMonth()),
  );
  if (today.getUTCDate() !== targetDay) return null;
  const milestone =
    ANNIVERSARY_MONTHS.includes(months) ||
    (months >= MONTHS_PER_YEAR && months % MONTHS_PER_YEAR === 0);
  return milestone ? months : null;
}

/** Push "ha X meses a usar a app" nos marcos de aniversario da conta. */
@Injectable()
export class AccountAnniversaryRemindersService {
  private readonly logger = new Logger(AccountAnniversaryRemindersService.name);
  // Dia (Lisboa) ja varrido: a varredura e por dia, nao de 15 em 15 min.
  private scannedDay: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushService: PushService,
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
    if (this.scannedDay === dayKey) return 0;
    this.scannedDay = dayKey;

    let sent = 0;
    let cursor: string | undefined;
    for (;;) {
      const users = await this.prisma.user.findMany({
        where: {
          status: { not: UserStatus.BANNED },
          pushSubscriptions: { some: {} },
          ...(cursor ? { id: { gt: cursor } } : {}),
        },
        select: {
          id: true,
          createdAt: true,
          quietHoursStart: true,
          quietHoursEnd: true,
        },
        orderBy: { id: 'asc' },
        take: USER_BATCH_SIZE,
      });
      for (const user of users) {
        const months = anniversaryMonths(user.createdAt, today);
        if (months === null || this.isQuietHour(user, nowMinutes)) continue;
        try {
          if (await this.notify(user.id, months)) sent += 1;
        } catch (err) {
          this.logger.error(
            `Aniversario: falhou o utilizador ${user.id} (${
              err instanceof Error ? err.name : 'erro'
            })`,
          );
        }
      }
      if (users.length < USER_BATCH_SIZE) break;
      cursor = users[users.length - 1].id;
    }
    if (sent > 0) this.logger.log(`Aniversario: ${sent} avisos enviados`);
    return sent;
  }

  private async notify(userId: string, months: number): Promise<boolean> {
    const period = `m${months}`;
    if (!(await this.sentNotifications.claim(userId, KIND, period))) {
      return false;
    }
    let delivered = 0;
    try {
      delivered = await this.pushService.notifyUser(
        userId,
        'accountAnniversary',
        { title: String(months), count: months, url: HOME_PATH },
      );
    } finally {
      if (delivered === 0) {
        await this.sentNotifications.release(userId, KIND, period);
      }
    }
    return delivered > 0;
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
