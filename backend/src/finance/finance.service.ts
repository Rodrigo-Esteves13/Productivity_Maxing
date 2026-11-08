import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import {
  FinanceAccountType,
  FinanceEntryKind,
  FinanceFrequency,
  FinanceInterestKind,
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
  CreateOwedPaymentDto,
  FinanceAnalyticsQueryDto,
  ImportFinanceEntriesDto,
  ImportFinanceEntryRowDto,
  UpdateFinanceAccountDto,
  UpdateFinanceEntryDto,
  UpdateFinanceGoalDto,
  UpdateFinanceHoldingDto,
  UpdateFinanceSettingsDto,
} from './dto/finance.dto';
import type { FinanceImportResult } from './finance.contract';
import {
  DEFAULT_ANALYTICS_GRANULARITY,
  DEFAULT_ANALYTICS_MONTHS,
  DEFAULT_FINANCE_CURRENCY,
  GOAL_PLAN_HISTORY_MONTHS,
  IDEMPOTENCY_WINDOW_MS,
  LEGACY_ACCOUNT_NAME,
  LEISURE_CATEGORY,
  MAX_ANALYTICS_RANGE_DAYS,
  MAX_FINANCE_ACCOUNTS_PER_USER,
  MAX_FINANCE_ENTRIES_PER_USER,
  MAX_FINANCE_GOALS_PER_USER,
  MAX_FINANCE_HOLDINGS_PER_USER,
  MAX_OCCURRENCES_PER_RULE,
  MAX_PAID_IN_ARREARS_MONTHS,
  OWED_PAYMENTS_HISTORY_LIMIT,
  SUBSCRIPTIONS_CATEGORY,
  UNASSIGNED_BUCKET,
} from './finance.constants';
import {
  firstPayDate,
  occurrencesInRange,
  resolveFrequency,
} from './finance-schedule.util';
import {
  addUtcMonths,
  estimateSurplus,
  historyMonthKeys,
  planGoals,
  type GoalInput,
} from './finance-goal-plan.util';
import {
  effectiveInterestKind,
  summarizeOwed,
  type OwedInput,
} from './finance-owed.util';
import {
  bucketize,
  materialize,
  type EntryRow,
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
const UNIQUE_VIOLATION = 'P2002';

/**
 * Chave de duplicado da importacao: mesmo dia, tipo, categoria, valor e nota
 * (nota vazia = sem nota). JSON evita colisoes com separadores na nota.
 */
export function importDedupeKey(row: {
  date: Date;
  kind: FinanceEntryKind;
  category: string;
  amountCents: number;
  note: string | null;
}): string {
  return JSON.stringify([
    toDateKey(row.date),
    row.kind,
    row.category,
    row.amountCents,
    row.note ?? '',
  ]);
}

/**
 * Chave de idempotencia do header ou do body (uuid). As duas tem de bater
 * quando vem as duas.
 */
export function resolveRequestKey(
  header: string | undefined,
  body: string | undefined,
): string | undefined {
  if (header !== undefined && !isUUID(header)) {
    throw new BadRequestException('Idempotency-Key must be a UUID.');
  }
  if (header && body && header !== body) {
    throw new BadRequestException(
      'Idempotency-Key and clientRequestId do not match.',
    );
  }
  return body ?? header;
}

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
  userId: string | Prisma.StringFilter,
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
          // Com paidInArrearsMonths o dinheiro chega ate N meses depois do
          // endDate (ancora); scheduleInRange corta o resto.
          {
            OR: [
              { endDate: null },
              {
                endDate: {
                  gte: addUtcMonths(start, -MAX_PAID_IN_ARREARS_MONTHS),
                },
              },
            ],
          },
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

interface IncomeRuleInput {
  skipFirstOccurrences: number;
  paidInArrearsMonths: number;
  withheldCents: number | null;
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
  existing: RuleInput &
    Partial<IncomeRuleInput> & {
      recurring?: boolean;
      kind?: FinanceEntryKind;
      amountCents?: number;
    },
): RuleInput & IncomeRuleInput & { recurring: boolean } {
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
  if (dto.skipFirstOccurrences && frequency === null) {
    throw new BadRequestException('skipFirstOccurrences needs a frequency.');
  }
  if (dto.paidInArrearsMonths && frequency !== FinanceFrequency.MONTHLY) {
    throw new BadRequestException(
      'paidInArrearsMonths needs frequency MONTHLY.',
    );
  }
  const repeatingIncome =
    frequency !== null &&
    (dto.kind ?? existing.kind) === FinanceEntryKind.INCOME;
  if (dto.withheldCents && !repeatingIncome) {
    throw new BadRequestException(
      'withheldCents needs a repeating INCOME entry.',
    );
  }
  // Valor do pedido, senao o que ja existe, senao o de omissao.
  const keep = <K extends keyof IncomeRuleInput>(
    key: K,
    fallback: IncomeRuleInput[K],
  ): IncomeRuleInput[K] =>
    (dto[key] as IncomeRuleInput[K] | undefined) ?? existing[key] ?? fallback;
  const withheldCents =
    !repeatingIncome || dto.withheldCents === null
      ? null
      : keep('withheldCents', null);
  // Retido acima do valor criava dinheiro: a primeira paga 0 e a devolucao
  // devolvia mais do que foi descontado.
  const amountCents = dto.amountCents ?? existing.amountCents;
  if (
    withheldCents !== null &&
    amountCents !== undefined &&
    withheldCents > amountCents
  ) {
    throw new BadRequestException('withheldCents must not exceed amountCents.');
  }
  return {
    date,
    frequency,
    payDayRule,
    payDay,
    endDate,
    skipFirstOccurrences:
      frequency === null ? 0 : keep('skipFirstOccurrences', 0),
    paidInArrearsMonths:
      frequency === FinanceFrequency.MONTHLY
        ? keep('paidInArrearsMonths', 0)
        : 0,
    withheldCents,
    // Mantido para leitores antigos: true sempre que ha repeticao.
    recurring: frequency !== null,
  };
}

interface OwedFields {
  isOwed: boolean;
  debtorName: string | null;
  expectedDate: Date | null;
  latePaymentRiskPct: number | null;
  interestRatePct: number | Prisma.Decimal | null;
  interestKind: FinanceInterestKind | null;
  receivedAt: Date | null;
}

const NOT_OWED: OwedFields = {
  isOwed: false,
  debtorName: null,
  expectedDate: null,
  latePaymentRiskPct: null,
  interestRatePct: null,
  interestKind: null,
  receivedAt: null,
};

const OWED_KEYS = Object.keys(NOT_OWED).filter(
  (k) => k !== 'isOwed',
) as (keyof UpdateFinanceEntryDto)[];

/**
 * Campos de "devem-me dinheiro". So INCOME de uma vez. Com juros o prazo e
 * obrigatorio. Ao receber (receivedAt), `date` passa a esse dia e a entrada
 * conta como uma entrada normal. Sem isOwed os campos sao limpos.
 */
export function resolveOwed(
  dto: UpdateFinanceEntryDto,
  existing: Partial<OwedFields> & { kind?: FinanceEntryKind },
  rule: { date: Date; frequency: FinanceFrequency | null },
): OwedFields & { date: Date } {
  const isOwed = dto.isOwed ?? existing.isOwed ?? false;
  if (!isOwed) {
    if (OWED_KEYS.some((k) => dto[k] !== undefined && dto[k] !== null)) {
      throw new BadRequestException('These fields need isOwed true.');
    }
    return { ...NOT_OWED, date: rule.date };
  }
  if ((dto.kind ?? existing.kind) !== FinanceEntryKind.INCOME) {
    throw new BadRequestException('isOwed needs kind INCOME.');
  }
  if (rule.frequency !== null) {
    throw new BadRequestException('isOwed entries happen once.');
  }
  const day = (key: 'expectedDate' | 'receivedAt') =>
    dto[key] === undefined
      ? (existing[key] ?? null)
      : dto[key] === null
        ? null
        : parseDay(dto[key], key);
  const expectedDate = day('expectedDate');
  const receivedAt = day('receivedAt');
  const interestRatePct =
    dto.interestRatePct !== undefined
      ? dto.interestRatePct
      : (existing.interestRatePct ?? null);
  const interestKind =
    dto.interestKind !== undefined
      ? dto.interestKind
      : (existing.interestKind ?? null);
  const hasInterest =
    effectiveInterestKind(
      interestKind,
      interestRatePct === null ? null : Number(interestRatePct),
    ) !== FinanceInterestKind.NONE;
  if (hasInterest && !expectedDate) {
    throw new BadRequestException('expectedDate is required with interest.');
  }
  // Ja recebido: `date` e o dia do pagamento, as datas antigas nao se comparam.
  const settled = receivedAt !== null && existing.receivedAt != null;
  if (!settled && expectedDate && expectedDate < rule.date) {
    throw new BadRequestException('expectedDate must not be before date.');
  }
  if (receivedAt && !settled && receivedAt < rule.date) {
    throw new BadRequestException('receivedAt must not be before date.');
  }
  return {
    isOwed,
    debtorName:
      dto.debtorName !== undefined
        ? dto.debtorName || null
        : (existing.debtorName ?? null),
    expectedDate,
    latePaymentRiskPct:
      dto.latePaymentRiskPct !== undefined
        ? dto.latePaymentRiskPct
        : (existing.latePaymentRiskPct ?? null),
    interestRatePct,
    interestKind,
    receivedAt,
    date: receivedAt ?? rule.date,
  };
}

/**
 * Projecao + valor esperado (pesado pelo risco) das dividas com prazo ate
 * ao fim do mes projetado (inclui as ja atrasadas). Sem prazo nao entram.
 */
export function withOwed(
  projection: { untilDate: string; projectedBalanceCents: number },
  items: ReturnType<typeof summarizeOwed>['items'],
) {
  const owedRiskWeightedCents = items
    .filter(
      (i) => i.expectedDate !== null && i.expectedDate <= projection.untilDate,
    )
    .reduce((a, i) => a + i.expectedValueCents, 0);
  return {
    ...projection,
    owedRiskWeightedCents,
    projectedBalanceCents:
      projection.projectedBalanceCents + owedRiskWeightedCents,
  };
}

/** Linha do Prisma para o util (Decimal da taxa passa a number). */
const owedInput = (
  e: FinanceEntry & { owedPayments?: OwedInput['payments'] },
): OwedInput => ({
  ...e,
  payments: e.owedPayments,
  interestRatePct:
    e.interestRatePct === null ? null : Number(e.interestRatePct),
});

/**
 * Dinheiro retido pelo empregador (withheldCents) que ja foi descontado
 * (primeira ocorrencia ate hoje) e ainda nao foi devolvido (sem endDate, ou
 * endDate depois de hoje). Nao conta no saldo.
 */
export function heldByEmployer(entries: EntryRow[], today: Date) {
  const items = entries.flatMap((e) => {
    if (e.kind !== FinanceEntryKind.INCOME || !e.withheldCents) return [];
    const since = resolveFrequency(e) ? firstPayDate(e) : null;
    const released = e.endDate !== null && e.endDate <= today;
    if (!since || since > today || released) return [];
    return [
      {
        entryId: e.id,
        note: e.note,
        withheldCents: e.withheldCents,
        since: toDateKey(since),
        releaseDate: e.endDate ? toDateKey(e.endDate) : null,
      },
    ];
  });
  return {
    totalCents: items.reduce((a, i) => a + i.withheldCents, 0),
    items,
  };
}

/**
 * Planos dos objetivos, sempre em relacao a HOJE (nao ao mes pedido).
 * Historico = os GOAL_PLAN_HISTORY_MONTHS meses completos antes do atual.
 */
export function goalPlansOf(
  entries: EntryRow[],
  goals: GoalInput[],
  today: Date,
) {
  const currentMonth = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1),
  );
  const history = materialize(
    entries,
    addUtcMonths(currentMonth, -GOAL_PLAN_HISTORY_MONTHS),
    currentMonth,
    today,
  );
  const recurring = entries.flatMap((e) => {
    const frequency = resolveFrequency(e);
    const active = frequency && (!e.endDate || e.endDate >= today);
    return active ? [{ ...e, frequency }] : [];
  });
  const surplus = estimateSurplus(
    history,
    historyMonthKeys(today, GOAL_PLAN_HISTORY_MONTHS),
    recurring,
  );
  return planGoals(goals, surplus, today);
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
    const currentMonth = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1),
    );
    const historyStart = addUtcMonths(currentMonth, -GOAL_PLAN_HISTORY_MONTHS);
    // Uma so query cobre o mes pedido, o resto do mes atual (projecao), o
    // historico dos planos e as retencoes ainda por devolver.
    const queryStart = [start, tomorrow, historyStart].reduce((a, b) =>
      b < a ? b : a,
    );
    const queryEnd = end > tomorrow ? end : tomorrow;
    const [wallet, entries, goals, owedRows] = await Promise.all([
      this.loadWallet(userId),
      this.prisma.financeEntry.findMany({
        where: overlappingEntriesWhere(userId, queryStart, queryEnd),
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.financeGoal.findMany({
        where: { userId },
        orderBy: [{ kind: 'asc' }, { createdAt: 'asc' }],
      }),
      // Dividas por receber: entram em `owed`, nunca nos totais nem no saldo.
      this.prisma.financeEntry.findMany({
        where: { userId, isOwed: true, receivedAt: null },
        orderBy: [{ expectedDate: 'asc' }, { createdAt: 'asc' }],
        include: {
          owedPayments: {
            select: { id: true, amountCents: true, paidAt: true },
          },
        },
      }),
    ]);
    const occurrences = materialize(entries, start, end, today);
    const owed = summarizeOwed(owedRows.map(owedInput), today);
    const projection = this.projection(
      wallet.balances.totalCents,
      tomorrow < end ? materialize(entries, tomorrow, end, today) : [],
      end,
    );
    const inMonth = new Set(occurrences.map((o) => o.entryId));
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
      projection,
      // Separado de projection: soma o valor esperado (pesado pelo risco)
      // das dividas com prazo ate ao fim do mes projetado.
      projectionWithOwed: withOwed(projection, owed.items),
      owed,
      heldByEmployer: heldByEmployer(entries, today),
      ...goalPlansOf(entries, goals, today),
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

  /**
   * Cria uma so vez por (userId, clientRequestId). Repetido dentro da janela
   * devolve a linha ja criada (duplo clique, retry); fora da janela da 409.
   * Dois pedidos ao mesmo tempo: o segundo bate no unique e le o primeiro.
   */
  private async idempotent<T extends { createdAt: Date }>(
    key: string | undefined,
    find: (clientRequestId: string) => Promise<T | null>,
    create: (clientRequestId: string | null) => Promise<T>,
  ): Promise<T> {
    if (!key) return create(null);
    const reuse = (row: T) => {
      if (Date.now() - row.createdAt.getTime() > IDEMPOTENCY_WINDOW_MS) {
        throw new ConflictException('This request key was already used.');
      }
      return row;
    };
    const existing = await find(key);
    if (existing) return reuse(existing);
    try {
      return await create(key);
    } catch (err) {
      if ((err as { code?: string } | null)?.code !== UNIQUE_VIOLATION) {
        throw err;
      }
      const winner = await find(key);
      if (!winner) throw err;
      return reuse(winner);
    }
  }

  async createEntry(
    userId: string,
    dto: CreateFinanceEntryDto,
    headerKey?: string,
  ) {
    const { clientRequestId, ...fields } = dto;
    return this.idempotent(
      resolveRequestKey(headerKey, clientRequestId),
      (key) =>
        this.prisma.financeEntry.findFirst({
          where: { userId, clientRequestId: key },
        }),
      async (key) => {
        const count = await this.prisma.financeEntry.count({
          where: { userId },
        });
        if (count >= MAX_FINANCE_ENTRIES_PER_USER) {
          throw new BadRequestException(
            `You can have at most ${MAX_FINANCE_ENTRIES_PER_USER} entries.`,
          );
        }
        await this.assertAccount(userId, fields.accountId);
        return this.prisma.financeEntry.create({
          data: {
            userId,
            clientRequestId: key,
            kind: fields.kind,
            amountCents: fields.amountCents,
            category: fields.category,
            note: fields.note || null,
            accountId: fields.accountId ?? null,
            ...this.ruleAndOwed(fields, { ...NO_RULE, kind: fields.kind }),
          },
        });
      },
    );
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
        ...this.ruleAndOwed(dto, existing),
      },
    });
    return this.prisma.financeEntry.findFirstOrThrow({ where: { id, userId } });
  }

  // Regra de repeticao + campos de divida (receber muda `date`).
  private ruleAndOwed(
    dto: UpdateFinanceEntryDto,
    existing: Parameters<typeof resolveRule>[1] & Partial<OwedFields>,
  ) {
    const rule = resolveRule(dto, existing);
    return { ...rule, ...resolveOwed(dto, existing, rule) };
  }

  /**
   * Pagamento parcial de uma divida: desce o principal, cria a entrada INCOME
   * do dia e regista o pagamento. Chegando a 0 a divida sai da lista.
   * Idempotency-Key opcional: fica no clientRequestId da entrada INCOME
   * criada (FinanceOwedPayment nao tem coluna propria); repetir a chave
   * devolve o principal atual sem pagar outra vez.
   */
  async addOwedPayment(
    userId: string,
    id: string,
    dto: CreateOwedPaymentDto,
    headerKey?: string,
  ): Promise<{ remainingCents: number }> {
    const result = await this.idempotent<{
      createdAt: Date;
      remainingCents?: number;
    }>(
      resolveRequestKey(headerKey, undefined),
      (key) =>
        this.prisma.financeEntry.findFirst({
          where: {
            userId,
            clientRequestId: key,
            kind: FinanceEntryKind.INCOME,
          },
          select: { createdAt: true },
        }),
      (key) => this.payOwed(userId, id, dto, key),
    );
    if (result.remainingCents !== undefined) {
      return { remainingCents: result.remainingCents };
    }
    // Repeticao: o pagamento ja foi feito; devolve o que ainda falta.
    const current = await this.prisma.financeEntry.findFirst({
      where: { id, userId, isOwed: true, receivedAt: null },
      select: { amountCents: true },
    });
    return { remainingCents: current?.amountCents ?? 0 };
  }

  /**
   * Escrita condicional: so desce o principal se a divida ainda estiver
   * igual ao que foi lido. Dois separadores ou um retry a pagar ao mesmo
   * tempo: o segundo nao encontra a linha igual (count 0) e da 409, sem
   * criar a segunda entrada INCOME.
   */
  private async payOwed(
    userId: string,
    id: string,
    dto: CreateOwedPaymentDto,
    clientRequestId: string | null,
  ) {
    const owed = await this.prisma.financeEntry.findFirst({
      where: { id, userId, isOwed: true, receivedAt: null },
    });
    if (!owed) throw new NotFoundException('Owed entry not found.');
    const paidAt = parseDay(dto.paidAt, 'paidAt');
    if (paidAt < owed.date) {
      throw new BadRequestException('paidAt must not be before date.');
    }
    if (dto.amountCents > owed.amountCents) {
      throw new BadRequestException(
        'Amount is above what is still owed as principal. Use Mark as received for the full amount.',
      );
    }
    const amountCents = dto.amountCents;
    const remainingCents = owed.amountCents - amountCents;
    return this.prisma.$transaction(async (tx) => {
      const unchanged = {
        id,
        userId,
        isOwed: true,
        receivedAt: null,
        amountCents: owed.amountCents,
      };
      const { count } =
        remainingCents > 0
          ? await tx.financeEntry.updateMany({
              where: unchanged,
              data: { amountCents: { decrement: amountCents } },
            })
          : await tx.financeEntry.deleteMany({ where: unchanged });
      if (count === 0) {
        throw new ConflictException('This debt changed, reload and try again.');
      }
      // Depois da escrita: ao saldar, a divida apagada liberta o lugar.
      const entryCount = await tx.financeEntry.count({ where: { userId } });
      if (entryCount >= MAX_FINANCE_ENTRIES_PER_USER) {
        throw new BadRequestException(
          `You can have at most ${MAX_FINANCE_ENTRIES_PER_USER} entries.`,
        );
      }
      const income = await tx.financeEntry.create({
        data: {
          userId,
          clientRequestId,
          kind: FinanceEntryKind.INCOME,
          amountCents,
          category: owed.category,
          note: owed.debtorName ?? owed.note,
          date: paidAt,
          accountId: owed.accountId,
        },
        select: { createdAt: true },
      });
      await tx.financeOwedPayment.create({
        data: {
          userId,
          entryId: remainingCents > 0 ? owed.id : null,
          debtorName: owed.debtorName,
          amountCents,
          paidAt,
        },
      });
      return { createdAt: income.createdAt, remainingCents };
    });
  }

  /**
   * Exportacao completa (CSV no frontend): todas as entradas (teto igual ao
   * limite por utilizador), pagamentos recebidos e nomes das contas. Pede
   * uma linha a mais para saber se cortou (truncated).
   */
  async exportAll(userId: string) {
    const [settings, accounts, entries, payments] = await Promise.all([
      this.prisma.financeSettings.findUnique({
        where: { userId },
        select: { currency: true },
      }),
      this.prisma.financeAccount.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        take: MAX_FINANCE_ACCOUNTS_PER_USER,
        select: { id: true, name: true },
      }),
      this.prisma.financeEntry.findMany({
        where: { userId },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: MAX_FINANCE_ENTRIES_PER_USER + 1,
        select: {
          id: true,
          kind: true,
          amountCents: true,
          category: true,
          note: true,
          date: true,
          recurring: true,
          frequency: true,
          accountId: true,
          isOwed: true,
          debtorName: true,
          receivedAt: true,
        },
      }),
      this.prisma.financeOwedPayment.findMany({
        where: { userId },
        orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
        take: MAX_FINANCE_ENTRIES_PER_USER + 1,
        select: {
          id: true,
          entryId: true,
          debtorName: true,
          amountCents: true,
          paidAt: true,
        },
      }),
    ]);
    const truncated =
      entries.length > MAX_FINANCE_ENTRIES_PER_USER ||
      payments.length > MAX_FINANCE_ENTRIES_PER_USER;
    return {
      currency: settings?.currency ?? DEFAULT_FINANCE_CURRENCY,
      truncated,
      accounts,
      entries: entries.slice(0, MAX_FINANCE_ENTRIES_PER_USER).map((e) => ({
        id: e.id,
        kind: e.kind,
        amountCents: e.amountCents,
        category: e.category,
        note: e.note,
        date: toDateKey(e.date),
        frequency: resolveFrequency(e),
        accountId: e.accountId,
        isOwed: e.isOwed,
        debtorName: e.debtorName,
        receivedAt: e.receivedAt ? toDateKey(e.receivedAt) : null,
      })),
      owedPayments: payments
        .slice(0, MAX_FINANCE_ENTRIES_PER_USER)
        .map((p) => ({
          id: p.id,
          entryId: p.entryId,
          debtorName: p.debtorName,
          amountCents: p.amountCents,
          paidAt: toDateKey(p.paidAt),
        })),
    };
  }

  /**
   * Importacao CSV (o formato do export). Nunca confia no dedupe do cliente:
   * numa so transacao salta duplicados exatos das entradas que ja existem
   * (contados como multiconjunto: duas linhas iguais no ficheiro contra uma
   * na base importam uma) e corta no teto de entradas. A conta vem pelo nome
   * (sem maiusculas) e so liga a contas da propria pessoa; senao fica sem.
   * Idempotency-Key fica no clientRequestId da primeira linha criada; a
   * repeticao devolve quantas linhas esse lote criou (todas com o mesmo
   * createdAt: o now() do Postgres e o do inicio da transacao).
   */
  async importEntries(
    userId: string,
    dto: ImportFinanceEntriesDto,
    headerKey?: string,
  ): Promise<FinanceImportResult> {
    const { rows } = dto;
    // Datas validadas antes de abrir a transacao (2026-02-31 = 400).
    const dates = rows.map((row) => parseDay(row.date, 'date'));
    const result = await this.idempotent<{
      createdAt: Date;
      imported?: number;
    }>(
      resolveRequestKey(headerKey, dto.clientRequestId),
      (key) =>
        this.prisma.financeEntry.findFirst({
          where: { userId, clientRequestId: key },
          select: { createdAt: true },
        }),
      (key) => this.insertImport(userId, rows, dates, key),
    );
    const imported =
      result.imported ??
      (await this.prisma.financeEntry.count({
        where: { userId, createdAt: result.createdAt },
      }));
    return { imported, skipped: rows.length - imported };
  }

  private insertImport(
    userId: string,
    rows: ImportFinanceEntryRowDto[],
    dates: Date[],
    clientRequestId: string | null,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const uniqueDates = [
        ...new Map(dates.map((d) => [d.getTime(), d])).values(),
      ];
      const count = await tx.financeEntry.count({ where: { userId } });
      const accounts = await tx.financeAccount.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        take: MAX_FINANCE_ACCOUNTS_PER_USER,
        select: { id: true, name: true },
      });
      const existing = await tx.financeEntry.findMany({
        where: { userId, date: { in: uniqueDates } },
        select: {
          date: true,
          kind: true,
          category: true,
          amountCents: true,
          note: true,
        },
      });
      // Nome repetido (sem maiusculas): ganha a conta mais antiga.
      const accountIds = new Map<string, string>();
      for (const a of accounts) {
        const name = a.name.trim().toLowerCase();
        if (!accountIds.has(name)) accountIds.set(name, a.id);
      }
      const existingCounts = new Map<string, number>();
      for (const e of existing) {
        const key = importDedupeKey(e);
        existingCounts.set(key, (existingCounts.get(key) ?? 0) + 1);
      }
      const room = Math.max(0, MAX_FINANCE_ENTRIES_PER_USER - count);
      const data: Prisma.FinanceEntryCreateManyInput[] = [];
      rows.forEach((row, i) => {
        const note = row.note || null;
        const key = importDedupeKey({ ...row, note, date: dates[i] });
        const left = existingCounts.get(key) ?? 0;
        if (left > 0) {
          existingCounts.set(key, left - 1);
          return;
        }
        if (data.length >= room) return;
        const frequency = row.frequency ?? null;
        data.push({
          userId,
          clientRequestId: data.length === 0 ? clientRequestId : null,
          kind: row.kind,
          amountCents: row.amountCents,
          category: row.category,
          note,
          date: dates[i],
          frequency,
          recurring: frequency !== null,
          accountId: row.accountName
            ? (accountIds.get(row.accountName.trim().toLowerCase()) ?? null)
            : null,
        });
      });
      if (data.length > 0) await tx.financeEntry.createMany({ data });
      return { createdAt: new Date(), imported: data.length };
    });
  }

  /** Ultimos pagamentos recebidos, incluindo os de dividas ja saldadas. */
  async listOwedPayments(userId: string) {
    const rows = await this.prisma.financeOwedPayment.findMany({
      where: { userId },
      orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
      take: OWED_PAYMENTS_HISTORY_LIMIT,
      select: { id: true, debtorName: true, amountCents: true, paidAt: true },
    });
    return rows.map((r) => ({
      id: r.id,
      debtorName: r.debtorName,
      amountCents: r.amountCents,
      paidAt: toDateKey(r.paidAt),
    }));
  }

  async removeEntry(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.financeEntry.deleteMany({
      where: { id, userId },
    });
    if (count === 0) throw new NotFoundException('Entry not found.');
  }

  async createAccount(
    userId: string,
    dto: CreateFinanceAccountDto,
    headerKey?: string,
  ) {
    return this.idempotent(
      resolveRequestKey(headerKey, dto.clientRequestId),
      (key) =>
        this.prisma.financeAccount.findFirst({
          where: { userId, clientRequestId: key },
        }),
      async (key) => {
        const count = await this.prisma.financeAccount.count({
          where: { userId },
        });
        if (count >= MAX_FINANCE_ACCOUNTS_PER_USER) {
          throw new BadRequestException(
            `You can have at most ${MAX_FINANCE_ACCOUNTS_PER_USER} accounts.`,
          );
        }
        return this.prisma.financeAccount.create({
          data: {
            userId,
            clientRequestId: key,
            name: dto.name,
            type: dto.type,
            balanceCents: dto.balanceCents ?? 0,
            currency: dto.currency ?? null,
          },
        });
      },
    );
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

  async createHolding(
    userId: string,
    dto: CreateFinanceHoldingDto,
    headerKey?: string,
  ) {
    if ((dto.quantity === undefined) === (dto.investedCents === undefined)) {
      throw new BadRequestException('Send either quantity or investedCents.');
    }
    const row = await this.idempotent(
      resolveRequestKey(headerKey, dto.clientRequestId),
      (key) =>
        this.prisma.financeHolding.findFirst({
          where: { userId, clientRequestId: key },
          include: { account: { select: { type: true } } },
        }),
      (key) => this.insertHolding(userId, dto, key),
    );
    return holdingView(row);
  }

  private async insertHolding(
    userId: string,
    dto: CreateFinanceHoldingDto,
    clientRequestId: string | null,
  ): Promise<HoldingRow> {
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
        clientRequestId,
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
    return this.findHolding(userId, created.id);
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

  async createGoal(
    userId: string,
    dto: CreateFinanceGoalDto,
    headerKey?: string,
  ) {
    return this.idempotent(
      resolveRequestKey(headerKey, dto.clientRequestId),
      (key) =>
        this.prisma.financeGoal.findFirst({
          where: { userId, clientRequestId: key },
        }),
      async (key) => {
        const count = await this.prisma.financeGoal.count({
          where: { userId },
        });
        if (count >= MAX_FINANCE_GOALS_PER_USER) {
          throw new BadRequestException(
            `You can have at most ${MAX_FINANCE_GOALS_PER_USER} goals.`,
          );
        }
        return this.prisma.financeGoal.create({
          data: {
            userId,
            clientRequestId: key,
            kind: dto.kind,
            name: dto.name,
            targetCents: dto.targetCents,
            savedCents: dto.savedCents ?? 0,
            deadline: dto.deadline ? parseDay(dto.deadline, 'deadline') : null,
            monthlyPlanCents: dto.monthlyPlanCents ?? null,
          },
        });
      },
    );
  }

  async updateGoal(userId: string, id: string, dto: UpdateFinanceGoalDto) {
    const { count } = await this.prisma.financeGoal.updateMany({
      where: { id, userId },
      data: {
        ...(dto.kind !== undefined && { kind: dto.kind }),
        ...(dto.monthlyPlanCents !== undefined && {
          monthlyPlanCents: dto.monthlyPlanCents,
        }),
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
