import { Injectable, Logger } from '@nestjs/common';
import { FinanceEntryKind, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import type { PushMessageKey } from '../push/push-messages';
import { addUtcDays, getLisbonNow, toDateKey } from '../common/date-key.util';
import {
  BUDGET_ALERT_OVER_PCT,
  BUDGET_ALERT_WARN_PCT,
  LEISURE_CATEGORY,
  PERCENT_SCALE,
} from '../finance/finance.constants';
import { overlappingEntriesWhere } from '../finance/finance.service';
import { scheduleInRange } from '../finance/finance-schedule.util';
import {
  isInMoneyReminderWindow,
  MONEY_REMINDER_USER_BATCH_SIZE,
} from './money-reminders.service';
import { SentNotificationService } from './sent-notification.service';
import {
  SENT_NOTIFICATION_KIND,
  type SentNotificationKind,
} from './sent-notification.constants';

const FINANCE_PATH = '/finance';
const MONTH_KEY_LENGTH = 'YYYY-MM'.length;
const KEY_SEPARATOR = '|';

type BudgetScope = 'total' | 'leisure';
type BudgetLevel = 'warn' | 'over';

// Tipo do marcador duravel por limite e por nivel (periodo = mes).
const KINDS: Record<BudgetScope, Record<BudgetLevel, SentNotificationKind>> = {
  total: {
    warn: SENT_NOTIFICATION_KIND.BUDGET_TOTAL_WARN,
    over: SENT_NOTIFICATION_KIND.BUDGET_TOTAL_OVER,
  },
  leisure: {
    warn: SENT_NOTIFICATION_KIND.BUDGET_LEISURE_WARN,
    over: SENT_NOTIFICATION_KIND.BUDGET_LEISURE_OVER,
  },
};

// Texto por limite e por nivel (sem valores nem percentagens no ecra de
// bloqueio).
const PUSH_KEYS: Record<BudgetScope, Record<BudgetLevel, PushMessageKey>> = {
  total: { warn: 'budgetWarn', over: 'budgetOver' },
  leisure: { warn: 'leisureBudgetWarn', over: 'leisureBudgetOver' },
};

interface CandidateUser {
  id: string;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
  financeSettings: {
    monthlyBudgetCents: number | null;
    leisureBudgetCents: number | null;
  } | null;
}

interface Limit {
  scope: BudgetScope;
  cents: number;
}

/**
 * Aviso de orcamento: quando as despesas REAIS do mes (Lisboa) chegam a
 * BUDGET_ALERT_WARN_PCT e depois a BUDGET_ALERT_OVER_PCT do limite mensal (ou
 * do limite de lazer), um push por limite e por nivel e por mes. Se os dois
 * niveis forem cruzados antes do primeiro aviso, so sai o mais alto.
 *
 * - Conta so despesas ate hoje (inclusive): ocorrencias futuras de regras que
 *   se repetem nao contam; dividas (isOwed) nao sao despesas.
 * - Quem nao tem dispositivos push, limite definido ou esta banido nem entra na
 *   query; as horas de silencio e a janela 09:00-20:00 (Lisboa) sao respeitadas.
 * - Queries em lote por pagina de users (1 de users + 1 de entradas).
 * - Dedupe mensal duravel em SentNotification (um tipo por limite e nivel,
 *   periodo = mes), sobrevive a restarts. So fica marcado quando algum
 *   dispositivo recebeu.
 */
@Injectable()
export class BudgetAlertRemindersService {
  private readonly logger = new Logger(BudgetAlertRemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushService: PushService,
    private readonly sentNotifications: SentNotificationService,
  ) {}

  /** Utilizadores avisados nesta execucao. */
  async sendReminders(): Promise<number> {
    const { today, nowMinutes } = getLisbonNow();
    if (!isInMoneyReminderWindow(nowMinutes)) return 0;
    const month = toDateKey(today).slice(0, MONTH_KEY_LENGTH);

    let sent = 0;
    let cursor: string | undefined;
    for (;;) {
      // Pagina por `id > ultimo id` (ver MoneyRemindersService).
      const users = await this.prisma.user.findMany({
        where: {
          status: { not: UserStatus.BANNED },
          pushSubscriptions: { some: {} },
          financeSettings: {
            is: {
              OR: [
                { monthlyBudgetCents: { not: null } },
                { leisureBudgetCents: { not: null } },
              ],
            },
          },
          ...(cursor ? { id: { gt: cursor } } : {}),
        },
        select: {
          id: true,
          quietHoursStart: true,
          quietHoursEnd: true,
          financeSettings: {
            select: { monthlyBudgetCents: true, leisureBudgetCents: true },
          },
        },
        orderBy: { id: 'asc' },
        take: MONEY_REMINDER_USER_BATCH_SIZE,
      });
      try {
        sent += await this.processPage(users, today, month, nowMinutes);
      } catch (err) {
        // Uma pagina que falha nao pode abortar as seguintes. Log so com o nome.
        this.logger.error(
          `Aviso de orcamento: falhou uma pagina (${
            err instanceof Error ? err.name : 'erro'
          })`,
        );
      }
      if (users.length < MONEY_REMINDER_USER_BATCH_SIZE) break;
      cursor = users[users.length - 1].id;
    }
    if (sent > 0) {
      this.logger.log(`Aviso de orcamento: ${sent} utilizadores avisados`);
    }
    return sent;
  }

  private async processPage(
    users: CandidateUser[],
    today: Date,
    month: string,
    nowMinutes: number,
  ): Promise<number> {
    const awake = users.filter((u) => !this.isQuietHour(u, nowMinutes));
    if (awake.length === 0) return 0;
    // 1 query por tipo (4 por pagina): marcadores duraveis deste mes.
    const claimed = await this.claimedKeys(
      awake.map((u) => u.id),
      month,
    );
    const limitsByUser = new Map<string, Limit[]>();
    for (const user of awake) {
      const limits = this.limitsOf(user).filter(
        (l) => !claimed.has(this.keyOf(user.id, l.scope, 'over')),
      );
      if (limits.length > 0) limitsByUser.set(user.id, limits);
    }
    if (limitsByUser.size === 0) return 0;

    const monthStart = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1),
    );
    const tomorrow = addUtcDays(today, 1);
    // 1 query para a pagina toda: despesas reais (nao dividas) que podem ter
    // ocorrencias neste mes.
    const entries = await this.prisma.financeEntry.findMany({
      where: {
        ...overlappingEntriesWhere(
          { in: [...limitsByUser.keys()] },
          monthStart,
          tomorrow,
        ),
        kind: FinanceEntryKind.EXPENSE,
        isOwed: false,
      },
      select: {
        userId: true,
        category: true,
        amountCents: true,
        date: true,
        recurring: true,
        frequency: true,
        payDayRule: true,
        payDay: true,
        endDate: true,
        skipFirstOccurrences: true,
        paidInArrearsMonths: true,
      },
    });

    // [monthStart, tomorrow) = ate hoje inclusive; o futuro fica de fora.
    const spent = new Map<string, { total: number; leisure: number }>();
    for (const entry of entries) {
      let cents = 0;
      for (const occ of scheduleInRange(entry, monthStart, tomorrow)) {
        cents += occ.amountCents;
      }
      if (cents === 0) continue;
      const sums = spent.get(entry.userId) ?? { total: 0, leisure: 0 };
      sums.total += cents;
      if (entry.category === LEISURE_CATEGORY) sums.leisure += cents;
      spent.set(entry.userId, sums);
    }

    let sent = 0;
    for (const [userId, limits] of limitsByUser) {
      const sums = spent.get(userId);
      if (!sums) continue;
      let delivered = false;
      for (const limit of limits) {
        const level = this.levelOf(sums[limit.scope], limit.cents);
        if (!level) continue;
        if (claimed.has(this.keyOf(userId, limit.scope, level))) continue;
        // Marcado ANTES do envio: uma execucao sobreposta ja o salta (o claim
        // falha). Passar o "over" cobre tambem o "warn" (nunca avisa o nivel
        // mais baixo depois do mais alto).
        const kind = KINDS[limit.scope][level];
        if (!(await this.sentNotifications.claim(userId, kind, month))) {
          continue;
        }
        const added: SentNotificationKind[] = [kind];
        if (level === 'over') {
          const warnKind = KINDS[limit.scope].warn;
          if (await this.sentNotifications.claim(userId, warnKind, month)) {
            added.push(warnKind);
          }
        }
        let count = 0;
        try {
          count = await this.pushService.notifyUser(
            userId,
            PUSH_KEYS[limit.scope][level],
            { url: FINANCE_PATH },
          );
        } finally {
          // Sem dispositivo que tenha recebido: desmarca so o que marcou aqui,
          // tenta outra vez na proxima execucao.
          if (count === 0) {
            for (const addedKind of added) {
              await this.sentNotifications.release(userId, addedKind, month);
            }
          }
        }
        if (count > 0) delivered = true;
      }
      if (delivered) sent += 1;
    }
    return sent;
  }

  private limitsOf(user: CandidateUser): Limit[] {
    const settings = user.financeSettings;
    const limits: Limit[] = [];
    // Limite 0 nao e um orcamento (evita avisar logo no primeiro cêntimo).
    if (settings?.monthlyBudgetCents && settings.monthlyBudgetCents > 0) {
      limits.push({ scope: 'total', cents: settings.monthlyBudgetCents });
    }
    if (settings?.leisureBudgetCents && settings.leisureBudgetCents > 0) {
      limits.push({ scope: 'leisure', cents: settings.leisureBudgetCents });
    }
    return limits;
  }

  /** Nivel mais alto atingido (inteiros: sem erros de arredondamento). */
  private levelOf(spentCents: number, limitCents: number): BudgetLevel | null {
    const scaled = spentCents * PERCENT_SCALE;
    if (scaled >= limitCents * BUDGET_ALERT_OVER_PCT) return 'over';
    if (scaled >= limitCents * BUDGET_ALERT_WARN_PCT) return 'warn';
    return null;
  }

  /** Chaves `userId|kind` dos marcadores deste mes, para os users dados. */
  private async claimedKeys(
    userIds: string[],
    month: string,
  ): Promise<Set<string>> {
    const kinds = Object.values(KINDS).flatMap((byLevel) =>
      Object.values(byLevel),
    );
    const sets = await Promise.all(
      kinds.map((kind) =>
        this.sentNotifications.claimedUserIds(userIds, kind, month),
      ),
    );
    const keys = new Set<string>();
    kinds.forEach((kind, i) => {
      for (const userId of sets[i])
        keys.add(`${userId}${KEY_SEPARATOR}${kind}`);
    });
    return keys;
  }

  private keyOf(userId: string, scope: BudgetScope, level: BudgetLevel) {
    return `${userId}${KEY_SEPARATOR}${KINDS[scope][level]}`;
  }

  private isQuietHour(user: CandidateUser, nowMinutes: number): boolean {
    const { quietHoursStart: start, quietHoursEnd: end } = user;
    if (start === null || end === null || start === end) return false;
    return start < end
      ? nowMinutes >= start && nowMinutes < end
      : nowMinutes >= start || nowMinutes < end;
  }
}
