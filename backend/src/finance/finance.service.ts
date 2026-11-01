import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FinanceAccountType,
  FinanceEntryKind,
  FinanceFrequency,
  FinancePayDayRule,
  Prisma,
  type FinanceAccount,
  type FinanceEntry,
  type FinanceHolding,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  addUtcDays,
  diffUtcDays,
  getLisbonNow,
  parseDateKey,
  toDateKey,
} from '../common/date-key.util';
import {
  CreateFinanceAccountDto,
  CreateFinanceEntryDto,
  CreateFinanceGoalDto,
  CreateFinanceHoldingDto,
  FinanceAnalyticsQueryDto,
  UpdateFinanceAccountDto,
  UpdateFinanceEntryDto,
  UpdateFinanceGoalDto,
  UpdateFinanceHoldingDto,
  UpdateFinanceSettingsDto,
} from './dto/finance.dto';
import {
  DEFAULT_ANALYTICS_GRANULARITY,
  DEFAULT_ANALYTICS_MONTHS,
  DEFAULT_FINANCE_CURRENCY,
  LEGACY_ACCOUNT_NAME,
  LEISURE_CATEGORY,
  MAX_ANALYTICS_RANGE_DAYS,
  MAX_FINANCE_ACCOUNTS_PER_USER,
  MAX_FINANCE_ENTRIES_PER_USER,
  MAX_FINANCE_GOALS_PER_USER,
  MAX_FINANCE_HOLDINGS_PER_USER,
  MAX_OCCURRENCES_PER_RULE,
  SUBSCRIPTIONS_CATEGORY,
  UNASSIGNED_BUCKET,
} from './finance.constants';
import { occurrencesInRange, resolveFrequency } from './finance-schedule.util';
import {
  bucketize,
  materialize,
  monthKey,
  monthlyCostCents,
  topCategories,
  type FinanceOccurrence,
} from './finance-analytics.util';
import {
  holdingBucket,
  holdingMetrics,
  quantityFromInvested,
} from './finance-holdings.util';
import { FinancePricesService } from './finance-prices.service';

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

/**
 * YYYY-MM-DD validado a serio. O DTO so ve o formato: "2026-13-01" dava
 * Invalid Date (500 na escrita, e NaN saltava o teto de dias da analitica)
 * e "2026-02-31" passava a 3 de marco sem aviso.
 */
export function parseDay(key: string, field: string): Date {
  const date = parseDateKey(key);
  if (Number.isNaN(date.getTime()) || toDateKey(date) !== key) {
    throw new BadRequestException(`${field} is not a valid date.`);
  }
  return date;
}

export interface Settings {
  currency: string;
  balanceCents: number;
  monthlyBudgetCents: number | null;
  leisureBudgetCents: number | null;
}

const DEFAULT_SETTINGS: Settings = {
  currency: DEFAULT_FINANCE_CURRENCY,
  balanceCents: 0,
  monthlyBudgetCents: null,
  leisureBudgetCents: null,
};

const SETTINGS_SELECT = {
  currency: true,
  balanceCents: true,
  monthlyBudgetCents: true,
  leisureBudgetCents: true,
} as const;

type HoldingRow = FinanceHolding & {
  account: { type: FinanceAccountType } | null;
};

/** [inicio do mes, inicio do mes seguinte) em meia-noite UTC. */
export function monthBounds(month: string): { start: Date; end: Date } {
  const match = MONTH_PATTERN.exec(month);
  if (!match) {
    throw new BadRequestException('month must be formatted YYYY-MM.');
  }
  const year = Number(match[1]);
  const index = Number(match[2]) - 1;
  return {
    start: new Date(Date.UTC(year, index, 1)),
    end: new Date(Date.UTC(year, index + 1, 1)),
  };
}

/** Somas de um mes. Despesas de LEISURE contam tambem para o lazer. */
export function summarize(
  entries: Pick<FinanceEntry, 'kind' | 'amountCents' | 'category'>[],
) {
  let income = 0;
  let expense = 0;
  const byCategory: Record<string, number> = {};
  for (const e of entries) {
    if (e.kind === FinanceEntryKind.INCOME) {
      income += e.amountCents;
    } else {
      expense += e.amountCents;
      byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amountCents;
    }
  }
  return {
    incomeCents: income,
    expenseCents: expense,
    netCents: income - expense,
    leisureCents: byCategory[LEISURE_CATEGORY] ?? 0,
    expensesByCategory: byCategory,
  };
}

/** Entradas com pelo menos uma ocorrencia possivel em [start, end). */
export function overlappingEntriesWhere(
  userId: string,
  start: Date,
  end: Date,
): Prisma.FinanceEntryWhereInput {
  return {
    userId,
    date: { lt: end },
    OR: [
      { date: { gte: start } },
      {
        AND: [
          { OR: [{ recurring: true }, { frequency: { not: null } }] },
          { OR: [{ endDate: null }, { endDate: { gte: start } }] },
        ],
      },
    ],
  };
}

/** Holding com as contas (valor, ganho, fracao de unidade) e o balde. */
export function holdingView(h: HoldingRow) {
  const { account, quantity: _quantity, ...rest } = h;
  void _quantity;
  return {
    ...rest,
    ...holdingMetrics(h),
    bucket: holdingBucket(h.symbol, account?.type ?? null),
  };
}
export type HoldingView = ReturnType<typeof holdingView>;

/**
 * Saldos por balde. Regra: contas e posicoes noutra moeda nao entram no
 * total (nao ha cambio); ficam em otherCurrencies. O saldo legado que ainda
 * nao passou para uma conta e o balde UNASSIGNED.
 */
export function computeBalances(
  currency: string,
  legacyCents: number,
  accounts: Pick<FinanceAccount, 'type' | 'balanceCents' | 'currency'>[],
  holdings: HoldingView[],
) {
  const byType: Record<string, number> = { [UNASSIGNED_BUCKET]: legacyCents };
  for (const type of Object.values(FinanceAccountType)) byType[type] = 0;
  const otherCurrencies: Record<string, number> = {};
  const add = (cur: string | null, bucket: string, cents: number) => {
    const c = cur ?? currency;
    if (c === currency) byType[bucket] += cents;
    else otherCurrencies[c] = (otherCurrencies[c] ?? 0) + cents;
    return c === currency;
  };
  for (const a of accounts) add(a.currency, a.type, a.balanceCents);
  let holdingsValueCents = 0;
  let costBasisCents = 0;
  let gainCents = 0;
  for (const h of holdings) {
    if (h.valueCents === null) continue;
    if (!add(h.priceCurrency, h.bucket, h.valueCents)) continue;
    holdingsValueCents += h.valueCents;
    if (h.costBasisCents !== null && h.gainCents !== null) {
      costBasisCents += h.costBasisCents;
      gainCents += h.gainCents;
    }
  }
  const totalCents = Object.values(byType).reduce((a, b) => a + b, 0);
  return {
    currency,
    totalCents,
    cashCents: totalCents - holdingsValueCents,
    holdingsValueCents,
    byType,
    otherCurrencies,
    investments: { valueCents: holdingsValueCents, costBasisCents, gainCents },
  };
}

interface RuleInput {
  date: Date;
  frequency: FinanceFrequency | null;
  payDayRule: FinancePayDayRule | null;
  payDay: number | null;
  endDate: Date | null;
}

const NO_RULE: RuleInput = {
  date: new Date(0),
  frequency: null,
  payDayRule: null,
  payDay: null,
  endDate: null,
};

/**
 * Junta o que veio no pedido com o que ja existe e valida a combinacao.
 * Campos que deixam de fazer sentido (payDayRule numa regra semanal) sao
 * limpos; so da erro quando o proprio pedido manda uma combinacao invalida.
 */
export function resolveRule(
  dto: UpdateFinanceEntryDto,
  existing: RuleInput & { recurring?: boolean },
): RuleInput & { recurring: boolean } {
  const legacy =
    dto.recurring === undefined
      ? resolveFrequency(existing)
      : dto.recurring
        ? (existing.frequency ?? FinanceFrequency.MONTHLY)
        : null;
  const frequency = dto.frequency !== undefined ? dto.frequency : legacy;
  if (dto.payDayRule && frequency !== FinanceFrequency.MONTHLY) {
    throw new BadRequestException('payDayRule needs frequency MONTHLY.');
  }
  const payDayRule =
    frequency === FinanceFrequency.MONTHLY
      ? dto.payDayRule !== undefined
        ? dto.payDayRule
        : existing.payDayRule
      : null;
  if (dto.payDay && payDayRule !== FinancePayDayRule.FIXED_DAY) {
    throw new BadRequestException('payDay needs payDayRule FIXED_DAY.');
  }
  const payDay =
    payDayRule === FinancePayDayRule.FIXED_DAY
      ? dto.payDay !== undefined
        ? dto.payDay
        : existing.payDay
      : null;
  const date = dto.date ? parseDay(dto.date, 'date') : existing.date;
  const endDate =
    dto.endDate === undefined
      ? existing.endDate
      : dto.endDate === null
        ? null
        : parseDay(dto.endDate, 'endDate');
  if (endDate && endDate < date) {
    throw new BadRequestException('endDate must not be before date.');
  }
  return {
    date,
    frequency,
    payDayRule,
    payDay,
    endDate,
    // Mantido para leitores antigos: true sempre que ha repeticao.
    recurring: frequency !== null,
  };
}

// Financas pessoais: so regista e soma o que a pessoa escreve. Nao ha
// ligacao a bancos nem recomendacoes. Regra das contas: o saldo de uma
// conta e escrito a mao; as entradas so a etiquetam (accountId) e nunca
// mexem no saldo, para nao contar duas vezes o que a pessoa ja atualizou.
@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly prices: FinancePricesService,
  ) {}

  async summary(userId: string, month: string, today = getLisbonNow().today) {
    const { start, end } = monthBounds(month);
    const tomorrow = addUtcDays(today, 1);
    const queryStart = tomorrow < start ? tomorrow : start;
    const [wallet, entries, goals] = await Promise.all([
      this.loadWallet(userId),
      this.prisma.financeEntry.findMany({
        where: overlappingEntriesWhere(userId, queryStart, end),
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.financeGoal.findMany({
        where: { userId },
        orderBy: [{ kind: 'asc' }, { createdAt: 'asc' }],
      }),
    ]);
    const occurrences = materialize(entries, start, end, today);
    const inMonth = new Set(occurrences.map((o) => o.entryId));
    const remaining =
      tomorrow < end ? materialize(entries, tomorrow, end, today) : [];
    return {
      month,
      settings: wallet.settings,
      entries: entries
        .filter((e) => inMonth.has(e.id))
        .map((e) => ({ ...e, frequency: resolveFrequency(e) })),
      occurrences,
      // Inclui as ocorrencias futuras (projected) do mes, como antes as
      // mensais contavam o mes inteiro.
      totals: summarize(occurrences),
      actualTotals: summarize(occurrences.filter((o) => !o.projected)),
      goals,
      accounts: wallet.accounts,
      holdings: wallet.holdings,
      balances: wallet.balances,
      projection: this.projection(wallet.balances.totalCents, remaining, end),
    };
  }

  async analytics(
    userId: string,
    query: FinanceAnalyticsQueryDto,
    today = getLisbonNow().today,
  ) {
    const granularity = query.granularity ?? DEFAULT_ANALYTICS_GRANULARITY;
    const monthStart = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1),
    );
    const monthEnd = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1),
    );
    const from = query.from
      ? parseDay(query.from, 'from')
      : new Date(
          Date.UTC(
            today.getUTCFullYear(),
            today.getUTCMonth() - (DEFAULT_ANALYTICS_MONTHS - 1),
            1,
          ),
        );
    const toInclusive = query.to
      ? parseDay(query.to, 'to')
      : addUtcDays(monthEnd, -1);
    if (toInclusive < from) {
      throw new BadRequestException('to must not be before from.');
    }
    if (diffUtcDays(from, toInclusive) > MAX_ANALYTICS_RANGE_DAYS) {
      throw new BadRequestException(
        `The range can be at most ${MAX_ANALYTICS_RANGE_DAYS} days.`,
      );
    }
    const to = addUtcDays(toInclusive, 1);
    const tomorrow = addUtcDays(today, 1);
    const [wallet, entries, remainingEntries, subscriptions] =
      await Promise.all([
        this.loadWallet(userId),
        this.prisma.financeEntry.findMany({
          where: overlappingEntriesWhere(userId, from, to),
        }),
        this.prisma.financeEntry.findMany({
          where: overlappingEntriesWhere(userId, tomorrow, monthEnd),
        }),
        this.prisma.financeEntry.findMany({
          where: {
            userId,
            kind: FinanceEntryKind.EXPENSE,
            category: SUBSCRIPTIONS_CATEGORY,
            AND: [
              { OR: [{ recurring: true }, { frequency: { not: null } }] },
              { OR: [{ endDate: null }, { endDate: { gte: today } }] },
            ],
          },
          orderBy: { amountCents: 'desc' },
        }),
      ]);
    const occurrences = materialize(entries, from, to, today);
    const series = bucketize(occurrences, from, to, granularity);
    const totals = summarize(occurrences);
    const items = subscriptions.map((s) => {
      const frequency = resolveFrequency(s) ?? FinanceFrequency.MONTHLY;
      const next = occurrencesInRange(
        s,
        today,
        addUtcDays(today, MAX_OCCURRENCES_PER_RULE),
      )[0];
      return {
        entryId: s.id,
        note: s.note,
        amountCents: s.amountCents,
        frequency,
        monthlyCostCents: monthlyCostCents(s.amountCents, frequency),
        nextDate: next ? toDateKey(next) : null,
        endDate: s.endDate ? toDateKey(s.endDate) : null,
        accountId: s.accountId,
      };
    });
    const remaining =
      tomorrow < monthEnd
        ? materialize(remainingEntries, tomorrow, monthEnd, today)
        : [];
    return {
      granularity,
      from: toDateKey(from),
      to: toDateKey(toInclusive),
      currency: wallet.settings.currency,
      totals: {
        incomeCents: totals.incomeCents,
        expenseCents: totals.expenseCents,
        netCents: totals.netCents,
      },
      series,
      topCategories: topCategories(series),
      subscriptions: {
        items,
        monthlyTotalCents: items.reduce((a, s) => a + s.monthlyCostCents, 0),
      },
      projection: {
        month: monthKey(monthStart),
        ...this.projection(wallet.balances.totalCents, remaining, monthEnd),
      },
    };
  }

  // Saldo previsto = saldo atual + ocorrencias depois de hoje ate ao fim do
  // mes. As de hoje assumem-se ja refletidas no saldo escrito a mao.
  private projection(
    balanceCents: number,
    remaining: FinanceOccurrence[],
    end: Date,
  ) {
    const totals = summarize(remaining);
    return {
      untilDate: toDateKey(addUtcDays(end, -1)),
      balanceCents,
      remainingIncomeCents: totals.incomeCents,
      remainingExpenseCents: totals.expenseCents,
      projectedBalanceCents: balanceCents + totals.netCents,
    };
  }

  /** Definicoes, contas, posicoes e saldos por balde (migra o legado). */
  private async loadWallet(userId: string) {
    const load = () =>
      Promise.all([
        this.prisma.financeSettings.findUnique({
          where: { userId },
          select: SETTINGS_SELECT,
        }),
        this.prisma.financeAccount.findMany({
          where: { userId },
          orderBy: [{ type: 'asc' }, { createdAt: 'asc' }],
        }),
      ]);
    let [settings, accounts] = await load();
    if (settings && settings.balanceCents !== 0 && accounts.length === 0) {
      await this.migrateLegacyBalance(userId, settings.balanceCents);
      [settings, accounts] = await load();
    }
    const rows: HoldingRow[] = await this.prisma.financeHolding.findMany({
      where: { userId },
      include: { account: { select: { type: true } } },
      orderBy: [{ symbol: 'asc' }, { createdAt: 'asc' }],
    });
    const holdings = rows.map(holdingView);
    const s = settings ?? DEFAULT_SETTINGS;
    return {
      settings: s,
      accounts,
      holdings,
      balances: computeBalances(s.currency, s.balanceCents, accounts, holdings),
    };
  }

  // Passa o saldo antigo para uma conta BANK, uma so vez. O updateMany com
  // o valor lido serve de trinco: num pedido concorrente devolve 0 linhas
  // e nao cria uma segunda conta. Tudo numa transacao: nada se perde.
  private migrateLegacyBalance(userId: string, balanceCents: number) {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.financeSettings.updateMany({
        where: { userId, balanceCents },
        data: { balanceCents: 0 },
      });
      if (count === 0) return;
      await tx.financeAccount.create({
        data: {
          userId,
          name: LEGACY_ACCOUNT_NAME,
          type: FinanceAccountType.BANK,
          balanceCents,
        },
      });
    });
  }

  updateSettings(userId: string, dto: UpdateFinanceSettingsDto) {
    return this.prisma.financeSettings.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: dto,
      select: SETTINGS_SELECT,
    });
  }

  private async assertAccount(userId: string, accountId?: string | null) {
    if (!accountId) return;
    const count = await this.prisma.financeAccount.count({
      where: { id: accountId, userId },
    });
    if (count === 0) throw new NotFoundException('Account not found.');
  }

  async createEntry(userId: string, dto: CreateFinanceEntryDto) {
    const count = await this.prisma.financeEntry.count({ where: { userId } });
    if (count >= MAX_FINANCE_ENTRIES_PER_USER) {
      throw new BadRequestException(
        `You can have at most ${MAX_FINANCE_ENTRIES_PER_USER} entries.`,
      );
    }
    await this.assertAccount(userId, dto.accountId);
    return this.prisma.financeEntry.create({
      data: {
        userId,
        kind: dto.kind,
        amountCents: dto.amountCents,
        category: dto.category,
        note: dto.note || null,
        accountId: dto.accountId ?? null,
        ...resolveRule(dto, NO_RULE),
      },
    });
  }

  async updateEntry(userId: string, id: string, dto: UpdateFinanceEntryDto) {
    const existing = await this.prisma.financeEntry.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new NotFoundException('Entry not found.');
    await this.assertAccount(userId, dto.accountId);
    await this.prisma.financeEntry.updateMany({
      where: { id, userId },
      data: {
        ...(dto.kind !== undefined && { kind: dto.kind }),
        ...(dto.amountCents !== undefined && { amountCents: dto.amountCents }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.note !== undefined && { note: dto.note || null }),
        ...(dto.accountId !== undefined && { accountId: dto.accountId }),
        ...resolveRule(dto, existing),
      },
    });
    return this.prisma.financeEntry.findFirstOrThrow({ where: { id, userId } });
  }

  async removeEntry(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.financeEntry.deleteMany({
      where: { id, userId },
    });
    if (count === 0) throw new NotFoundException('Entry not found.');
  }

  async createAccount(userId: string, dto: CreateFinanceAccountDto) {
    const count = await this.prisma.financeAccount.count({ where: { userId } });
    if (count >= MAX_FINANCE_ACCOUNTS_PER_USER) {
      throw new BadRequestException(
        `You can have at most ${MAX_FINANCE_ACCOUNTS_PER_USER} accounts.`,
      );
    }
    return this.prisma.financeAccount.create({
      data: {
        userId,
        name: dto.name,
        type: dto.type,
        balanceCents: dto.balanceCents ?? 0,
        currency: dto.currency ?? null,
      },
    });
  }

  async updateAccount(
    userId: string,
    id: string,
    dto: UpdateFinanceAccountDto,
  ) {
    const { count } = await this.prisma.financeAccount.updateMany({
      where: { id, userId },
      data: dto,
    });
    if (count === 0) throw new NotFoundException('Account not found.');
    return this.prisma.financeAccount.findFirstOrThrow({
      where: { id, userId },
    });
  }

  // Entradas e posicoes ligadas ficam sem conta (onDelete: SetNull).
  async removeAccount(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.financeAccount.deleteMany({
      where: { id, userId },
    });
    if (count === 0) throw new NotFoundException('Account not found.');
  }

  private async findHolding(userId: string, id: string) {
    const holding = await this.prisma.financeHolding.findFirst({
      where: { id, userId },
      include: { account: { select: { type: true } } },
    });
    if (!holding) throw new NotFoundException('Holding not found.');
    return holding;
  }

  async createHolding(userId: string, dto: CreateFinanceHoldingDto) {
    if ((dto.quantity === undefined) === (dto.investedCents === undefined)) {
      throw new BadRequestException('Send either quantity or investedCents.');
    }
    const count = await this.prisma.financeHolding.count({ where: { userId } });
    if (count >= MAX_FINANCE_HOLDINGS_PER_USER) {
      throw new BadRequestException(
        `You can have at most ${MAX_FINANCE_HOLDINGS_PER_USER} holdings.`,
      );
    }
    await this.assertAccount(userId, dto.accountId);
    const quote = await this.prices.quoteFor(dto.symbol);
    const price = dto.priceCents ?? quote?.priceCents ?? null;
    const quantity = this.quantityOf(dto, price);
    const created = await this.prisma.financeHolding.create({
      data: {
        userId,
        symbol: dto.symbol,
        name: dto.name || dto.symbol,
        accountId: dto.accountId ?? null,
        quantity,
        lastPriceCents: price,
        // Preco escrito a mao = moeda das definicoes (null).
        priceCurrency: dto.priceCents ? null : (quote?.currency ?? null),
        priceUpdatedAt:
          price === null ? null : (quote?.fetchedAt ?? new Date()),
        costBasisCents:
          dto.costBasisCents !== undefined
            ? dto.costBasisCents
            : (dto.investedCents ?? null),
      },
    });
    return holdingView(await this.findHolding(userId, created.id));
  }

  async updateHolding(
    userId: string,
    id: string,
    dto: UpdateFinanceHoldingDto,
  ) {
    if (dto.quantity !== undefined && dto.investedCents !== undefined) {
      throw new BadRequestException('Send either quantity or investedCents.');
    }
    const existing = await this.findHolding(userId, id);
    await this.assertAccount(userId, dto.accountId);
    const price = dto.priceCents ?? existing.lastPriceCents;
    const changesQuantity =
      dto.quantity !== undefined || dto.investedCents !== undefined;
    await this.prisma.financeHolding.updateMany({
      where: { id, userId },
      data: {
        ...(dto.name !== undefined && { name: dto.name || existing.symbol }),
        ...(dto.accountId !== undefined && { accountId: dto.accountId }),
        ...(changesQuantity && { quantity: this.quantityOf(dto, price) }),
        ...(dto.priceCents !== undefined && {
          lastPriceCents: dto.priceCents,
          priceCurrency: null,
          priceUpdatedAt: new Date(),
        }),
        // Igual ao create: sem costBasisCents, o novo valor investido passa a
        // ser o custo (senao o ganho comparava com o custo antigo).
        ...(dto.costBasisCents !== undefined
          ? { costBasisCents: dto.costBasisCents }
          : dto.investedCents !== undefined && {
              costBasisCents: dto.investedCents,
            }),
      },
    });
    return holdingView(await this.findHolding(userId, id));
  }

  async removeHolding(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.financeHolding.deleteMany({
      where: { id, userId },
    });
    if (count === 0) throw new NotFoundException('Holding not found.');
  }

  async refreshPrices(userId: string) {
    const result = await this.prices.refreshForUser(userId);
    const rows: HoldingRow[] = await this.prisma.financeHolding.findMany({
      where: { userId },
      include: { account: { select: { type: true } } },
      orderBy: [{ symbol: 'asc' }, { createdAt: 'asc' }],
    });
    return { ...result, holdings: rows.map(holdingView) };
  }

  // Quantidade escrita ou investedCents / preco. Sempre > 0.
  private quantityOf(
    dto: { quantity?: string; investedCents?: number },
    priceCents: number | null,
  ): string {
    let quantity = dto.quantity;
    if (quantity === undefined) {
      if (!priceCents) {
        throw new BadRequestException(
          'No price available for this symbol. Send priceCents or quantity.',
        );
      }
      quantity = quantityFromInvested(dto.investedCents ?? 0, priceCents);
    }
    if (!new Prisma.Decimal(quantity).gt(0)) {
      throw new BadRequestException('quantity must be greater than 0.');
    }
    return quantity;
  }

  async createGoal(userId: string, dto: CreateFinanceGoalDto) {
    const count = await this.prisma.financeGoal.count({ where: { userId } });
    if (count >= MAX_FINANCE_GOALS_PER_USER) {
      throw new BadRequestException(
        `You can have at most ${MAX_FINANCE_GOALS_PER_USER} goals.`,
      );
    }
    return this.prisma.financeGoal.create({
      data: {
        userId,
        kind: dto.kind,
        name: dto.name,
        targetCents: dto.targetCents,
        savedCents: dto.savedCents ?? 0,
        deadline: dto.deadline ? parseDay(dto.deadline, 'deadline') : null,
      },
    });
  }

  async updateGoal(userId: string, id: string, dto: UpdateFinanceGoalDto) {
    const { count } = await this.prisma.financeGoal.updateMany({
      where: { id, userId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.targetCents !== undefined && { targetCents: dto.targetCents }),
        ...(dto.savedCents !== undefined && { savedCents: dto.savedCents }),
        ...(dto.deadline !== undefined && {
          deadline:
            dto.deadline === null ? null : parseDay(dto.deadline, 'deadline'),
        }),
      },
    });
    if (count === 0) throw new NotFoundException('Goal not found.');
    return this.prisma.financeGoal.findFirstOrThrow({ where: { id, userId } });
  }

  async removeGoal(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.financeGoal.deleteMany({
      where: { id, userId },
    });
    if (count === 0) throw new NotFoundException('Goal not found.');
  }
}
