import { Injectable, Logger } from '@nestjs/common';
import { FinanceEntryKind, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { addUtcDays, getLisbonNow, toDateKey } from '../common/date-key.util';
import { MINUTES_PER_HOUR } from '../common/time.constants';
import { SUBSCRIPTIONS_CATEGORY } from '../finance/finance.constants';
import { occurrencesInRange } from '../finance/finance-schedule.util';

// Janela de envio (hora de Lisboa): horas de dia, nunca de madrugada. O cron
// externo corre de 15 em 15 min (docs/adr/0006-external-cron-for-reminders.md),
// por isso ha varias execucoes dentro da janela e um envio falhado volta a
// tentar.
export const MONEY_REMINDER_WINDOW_START_MINUTES = 9 * MINUTES_PER_HOUR;
export const MONEY_REMINDER_WINDOW_END_MINUTES = 20 * MINUTES_PER_HOUR;
// Utilizadores processados por pagina (cursor por id, ordem estavel).
export const MONEY_REMINDER_USER_BATCH_SIZE = 500;
// Dividas em atraso so voltam a avisar uma vez por semana (segunda-feira;
// `today` e meia-noite UTC do dia de Lisboa, getUTCDay() 1 = segunda).
export const MONEY_REMINDER_OVERDUE_WEEKDAY_UTC_INDEX = 1;
const FINANCE_PATH = '/finance';

/** 09:00-20:00 em Lisboa (`nowMinutes` = minutos desde a meia-noite). */
export function isInMoneyReminderWindow(nowMinutes: number): boolean {
  return (
    nowMinutes >= MONEY_REMINDER_WINDOW_START_MINUTES &&
    nowMinutes < MONEY_REMINDER_WINDOW_END_MINUTES
  );
}

interface CandidateUser {
  id: string;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
}

/**
 * Aviso de dinheiro: no maximo UM push por user e por dia de Lisboa, que junta
 * duas coisas (so contagem no texto, nunca nomes nem valores no ecra de
 * bloqueio):
 * - subscricoes (despesa recorrente da categoria SUBSCRIPTIONS) cuja proxima
 *   ocorrencia e amanha;
 * - dividas a receber (isOwed, receivedAt null) com prazo amanha ou em atraso.
 *   As em atraso so contam as segundas-feiras, para nao massacrar.
 *
 * - Quem nao tem dispositivos push nem entra na query; banidos tambem nao; as
 *   horas de silencio do user sao respeitadas.
 * - Queries em lote por pagina de users (2 por pagina), nunca por user.
 * - Sem tabela nova, o dedupe diario e em memoria (como o aviso de streak e o
 *   de limite de faltas; so ha uma instancia no Render). So fica marcado
 *   quando algum dispositivo recebeu. Risco residual aceite: um restart dentro
 *   da janela (09:00-20:00) pode reenviar o aviso uma vez nesse dia.
 */
@Injectable()
export class MoneyRemindersService {
  private readonly logger = new Logger(MoneyRemindersService.name);
  // userId -> dia (YYYY-MM-DD, Lisboa) em que foi avisado.
  private readonly notifiedDay = new Map<string, string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushService: PushService,
  ) {}

  // O relogio vem de getLisbonNow() (hora de Lisboa).
  async sendReminders(): Promise<number> {
    const { today, nowMinutes } = getLisbonNow();
    if (!isInMoneyReminderWindow(nowMinutes)) return 0;
    const dayKey = toDateKey(today);
    // Dia novo: esquece os anteriores (o mapa nao cresce sem fim).
    for (const [userId, day] of this.notifiedDay) {
      if (day !== dayKey) this.notifiedDay.delete(userId);
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
        take: MONEY_REMINDER_USER_BATCH_SIZE,
      });
      try {
        sent += await this.processPage(users, today, dayKey, nowMinutes);
      } catch (err) {
        // Uma pagina que falha nao pode abortar as seguintes. Log so com o nome.
        this.logger.error(
          `Aviso de dinheiro: falhou uma pagina (${
            err instanceof Error ? err.name : 'erro'
          })`,
        );
      }
      if (users.length < MONEY_REMINDER_USER_BATCH_SIZE) break;
      cursor = users[users.length - 1].id;
    }
    if (sent > 0) {
      this.logger.log(`Aviso de dinheiro: ${sent} utilizadores avisados`);
    }
    return sent;
  }

  private async processPage(
    users: CandidateUser[],
    today: Date,
    dayKey: string,
    nowMinutes: number,
  ): Promise<number> {
    const pending = users.filter(
      (u) =>
        this.notifiedDay.get(u.id) !== dayKey &&
        !this.isQuietHour(u, nowMinutes),
    );
    if (pending.length === 0) return 0;

    const ids = pending.map((u) => u.id);
    const tomorrow = addUtcDays(today, 1);
    const dayAfter = addUtcDays(today, 2);
    const includeOverdue =
      today.getUTCDay() === MONEY_REMINDER_OVERDUE_WEEKDAY_UTC_INDEX;

    // 2 queries para a pagina toda.
    const [subscriptions, owed] = await Promise.all([
      this.prisma.financeEntry.findMany({
        where: {
          userId: { in: ids },
          kind: FinanceEntryKind.EXPENSE,
          category: SUBSCRIPTIONS_CATEGORY,
          isOwed: false,
          // So as que se repetem e ja comecaram ate amanha (a regra nao tem
          // ocorrencias antes de `date`) e ainda nao terminaram.
          date: { lte: tomorrow },
          AND: [
            { OR: [{ recurring: true }, { frequency: { not: null } }] },
            { OR: [{ endDate: null }, { endDate: { gte: tomorrow } }] },
          ],
        },
        select: {
          userId: true,
          date: true,
          recurring: true,
          frequency: true,
          payDayRule: true,
          payDay: true,
          endDate: true,
          skipFirstOccurrences: true,
          paidInArrearsMonths: true,
        },
      }),
      this.prisma.financeEntry.findMany({
        where: {
          userId: { in: ids },
          isOwed: true,
          receivedAt: null,
          // Prazo amanha, ou em atraso (so entra segunda-feira).
          expectedDate: includeOverdue
            ? { lt: dayAfter }
            : { gte: tomorrow, lt: dayAfter },
        },
        select: { userId: true, expectedDate: true },
      }),
    ]);

    const countByUser = new Map<string, number>();
    const bump = (userId: string) =>
      countByUser.set(userId, (countByUser.get(userId) ?? 0) + 1);
    for (const sub of subscriptions) {
      if (occurrencesInRange(sub, tomorrow, dayAfter).length > 0) {
        bump(sub.userId);
      }
    }
    for (const row of owed) {
      // expectedDate de hoje nao conta: nem "amanha" nem "em atraso".
      if (row.expectedDate && !this.isToday(row.expectedDate, today)) {
        bump(row.userId);
      }
    }

    let sent = 0;
    for (const user of pending) {
      const count = countByUser.get(user.id);
      if (!count) continue;
      // Marcado ANTES do envio: uma execucao sobreposta ja o salta.
      this.notifiedDay.set(user.id, dayKey);
      let delivered = 0;
      try {
        delivered = await this.pushService.notifyUser(
          user.id,
          'moneyReminder',
          { count, url: FINANCE_PATH },
        );
      } finally {
        // Sem dispositivo que tenha recebido: desmarca, tenta na proxima.
        if (delivered === 0) this.notifiedDay.delete(user.id);
      }
      if (delivered > 0) sent += 1;
    }
    return sent;
  }

  private isToday(date: Date, today: Date): boolean {
    return date.getTime() === today.getTime();
  }

  private isQuietHour(user: CandidateUser, nowMinutes: number): boolean {
    const { quietHoursStart: start, quietHoursEnd: end } = user;
    if (start === null || end === null || start === end) return false;
    return start < end
      ? nowMinutes >= start && nowMinutes < end
      : nowMinutes >= start || nowMinutes < end;
  }
}
