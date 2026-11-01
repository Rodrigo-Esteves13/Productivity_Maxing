/**
 * Finance API contract (para o frontend). Tudo autenticado (JWT + CSRF nos
 * pedidos que escrevem). Valores em centimos (Int). Datas de dia sao
 * "YYYY-MM-DD" (dia de Lisboa); timestamps sao ISO 8601. Escritas limitadas
 * a FINANCE_WRITES_PER_MINUTE (60/min); refresh de precos a 5/min.
 *
 * Rotas
 * -----------------------------------------------------------------------
 * GET    /finance?month=YYYY-MM          -> FinanceSummary          (CHANGED: campos novos, ver abaixo)
 * GET    /finance/analytics?granularity=week|month&from=YYYY-MM-DD&to=YYYY-MM-DD
 *                                         -> FinanceAnalytics        (NEW; tudo opcional; to inclusive;
 *                                            omissao: month, ultimos 6 meses ate ao fim do mes atual;
 *                                            maximo 731 dias)
 * PUT    /finance/settings               body UpdateFinanceSettingsBody -> FinanceSettings (balanceCents DEPRECATED)
 * POST   /finance/entries                body CreateFinanceEntryBody -> FinanceEntryRow   (CHANGED: campos novos)
 * PATCH  /finance/entries/:id            body Partial<CreateFinanceEntryBody> -> FinanceEntryRow (NEW)
 * DELETE /finance/entries/:id            -> 204
 * POST   /finance/accounts               body CreateFinanceAccountBody -> FinanceAccountRow (NEW)
 * PATCH  /finance/accounts/:id           body Partial<CreateFinanceAccountBody> -> FinanceAccountRow (NEW)
 * DELETE /finance/accounts/:id           -> 204 (entradas/posicoes ligadas ficam sem conta) (NEW)
 * POST   /finance/holdings/refresh       -> PriceRefreshResponse    (NEW; cada simbolo vai ao fornecedor
 *                                            no maximo de 5 em 5 minutos; senao usa a cache)
 * POST   /finance/holdings               body CreateFinanceHoldingBody -> FinanceHoldingView (NEW)
 * PATCH  /finance/holdings/:id           body UpdateFinanceHoldingBody -> FinanceHoldingView (NEW)
 * DELETE /finance/holdings/:id           -> 204 (NEW)
 * POST   /finance/goals, PATCH/DELETE /finance/goals/:id   (sem alteracoes)
 *
 * Mudancas de forma em rotas que ja existiam
 * - GET /finance:
 *   - `entries`: so as linhas com pelo menos uma ocorrencia no mes (igual a
 *     antes na pratica). Cada linha ganha frequency (ja resolvida: legado
 *     recurring=true vem como MONTHLY), payDayRule, payDay, endDate, accountId.
 *   - `totals`: agora soma as OCORRENCIAS do mes (uma subscricao semanal
 *     conta 4-5 vezes), incluindo as futuras (projected). Mesmo formato.
 *   - novos: occurrences, actualTotals, accounts, holdings, balances, projection.
 *   - `settings.balanceCents` passa a 0 depois da migracao automatica (o
 *     valor vai para uma conta BANK "Main account"); usar balances.totalCents.
 * - POST /finance/entries: aceita frequency/payDayRule/payDay/endDate/
 *   accountId. `recurring` continua a funcionar (true = MONTHLY no dia).
 * - Categorias novas: GROCERIES, CAFE, DINING, SHOPPING, INVESTING, CRYPTO.
 *
 * Regras
 * - Saldos sao escritos a mao por conta. Entradas NUNCA mexem no saldo de
 *   uma conta; accountId e so etiqueta (filtros/analytics).
 * - balances.totalCents = contas + valor das posicoes + saldo legado
 *   (UNASSIGNED). Contas/posicoes noutra moeda nao entram (sem cambio) e
 *   aparecem em otherCurrencies.
 * - Posicao sem conta: simbolo BASE-MOEDA (BTC-EUR) conta em CRYPTO, o
 *   resto em INVESTMENT. Com conta: no tipo da conta.
 * - projection: saldo atual + ocorrencias depois de HOJE ate ao fim do mes
 *   pedido (as de hoje assumem-se ja no saldo). Num mes futuro e o saldo
 *   planeado; num mes passado e igual ao saldo atual.
 * - Dias uteis = segunda a sexta, sem feriados.
 * - Precos: cron de hora a hora (Yahoo Finance). Falhas mantem o ultimo
 *   preco; priceUpdatedAt diz de quando e.
 */

import type {
  FinanceAccountType,
  FinanceEntryKind,
  FinanceFrequency,
  FinanceGoalKind,
  FinancePayDayRule,
} from '@prisma/client';
import type {
  AnalyticsGranularity,
  FinanceCategory,
} from './finance.constants';

type DateKey = string; // YYYY-MM-DD
type IsoDateTime = string;
type Bucket = FinanceAccountType | 'UNASSIGNED';

export interface FinanceSettings {
  currency: string;
  /** DEPRECATED: saldo legado ainda sem conta. */
  balanceCents: number;
  monthlyBudgetCents: number | null;
  leisureBudgetCents: number | null;
}

export interface UpdateFinanceSettingsBody {
  currency?: string;
  /** DEPRECATED: preferir contas. */
  balanceCents?: number;
  monthlyBudgetCents?: number | null;
  leisureBudgetCents?: number | null;
}

export interface CreateFinanceEntryBody {
  kind: FinanceEntryKind;
  amountCents: number; // 1..MAX
  category: FinanceCategory;
  note?: string; // <= 120
  /** Unica ocorrencia, ou a primeira possivel de uma regra. */
  date: DateKey;
  /** DEPRECATED: true = MONTHLY. frequency ganha se vierem os dois. */
  recurring?: boolean;
  /** null/ausente = uma vez. */
  frequency?: FinanceFrequency | null;
  /** So com MONTHLY. null = mesmo dia de `date` (cortado ao fim do mes). */
  payDayRule?: FinancePayDayRule | null;
  /** 1..31, so com FIXED_DAY. null = dia de `date`. */
  payDay?: number | null;
  /** Inclusive. Cancelar uma subscricao = por endDate. */
  endDate?: DateKey | null;
  accountId?: string | null;
}

export interface FinanceEntryRow {
  id: string;
  userId: string;
  kind: FinanceEntryKind;
  amountCents: number;
  category: string;
  note: string | null;
  date: IsoDateTime;
  recurring: boolean;
  frequency: FinanceFrequency | null;
  payDayRule: FinancePayDayRule | null;
  payDay: number | null;
  endDate: IsoDateTime | null;
  accountId: string | null;
  createdAt: IsoDateTime;
}

export interface FinanceOccurrence {
  entryId: string;
  date: DateKey;
  kind: FinanceEntryKind;
  amountCents: number;
  category: string;
  note: string | null;
  accountId: string | null;
  frequency: FinanceFrequency | null;
  /** true = data depois de hoje (ainda nao aconteceu). */
  projected: boolean;
}

export interface FinanceTotals {
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  leisureCents: number;
  expensesByCategory: Record<string, number>;
}

export interface CreateFinanceAccountBody {
  name: string; // <= 60
  type: FinanceAccountType;
  /** Dinheiro parado na conta (sem posicoes). Pode ser negativo. */
  balanceCents?: number;
  /** null = moeda das definicoes. */
  currency?: string | null;
}

export interface FinanceAccountRow {
  id: string;
  userId: string;
  name: string;
  type: FinanceAccountType;
  balanceCents: number;
  currency: string | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

/** Manda quantity OU investedCents (nunca os dois). */
export interface CreateFinanceHoldingBody {
  /** /^[A-Z0-9.\-=^]{1,20}$/ depois de maiusculas (ex.: VWCE.DE, BTC-EUR). */
  symbol: string;
  name?: string; // vazio = simbolo
  accountId?: string | null;
  /** Texto decimal, ate 6 casas: "0.666152". */
  quantity?: string;
  /** quantity = investedCents / (priceCents ?? cotacao atual). */
  investedCents?: number;
  /** Preco manual de uma unidade (moeda das definicoes). */
  priceCents?: number;
  /** Omissao: investedCents (ou null). */
  costBasisCents?: number | null;
}

/** Sem symbol. investedCents usa priceCents ou o ultimo preco guardado. */
export type UpdateFinanceHoldingBody = Partial<
  Omit<CreateFinanceHoldingBody, 'symbol'>
>;

export interface FinanceHoldingView {
  id: string;
  userId: string;
  accountId: string | null;
  symbol: string;
  name: string;
  /** "0.666152" (6 casas). */
  quantity: string;
  /** Preco de uma unidade inteira, em centimos de priceCurrency. */
  lastPriceCents: number | null;
  /** null = moeda das definicoes (preco manual). */
  priceCurrency: string | null;
  priceUpdatedAt: IsoDateTime | null;
  costBasisCents: number | null;
  valueCents: number | null;
  gainCents: number | null;
  gainPercent: number | null;
  /** = lastPriceCents: quanto custa uma unidade inteira. */
  fullSharePriceCents: number | null;
  /** quantity x 100 (0.666152 => 66.62). */
  percentOfFullShare: number;
  bucket: FinanceAccountType;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface FinanceBalances {
  currency: string;
  /** Contas + posicoes + legado, so na moeda das definicoes. */
  totalCents: number;
  cashCents: number;
  holdingsValueCents: number;
  /** Todas as chaves presentes (0 quando vazio). */
  byType: Record<Bucket, number>;
  otherCurrencies: Record<string, number>;
  investments: {
    valueCents: number;
    costBasisCents: number;
    gainCents: number;
  };
}

export interface FinanceProjection {
  /** Ultimo dia do mes projetado. */
  untilDate: DateKey;
  balanceCents: number;
  remainingIncomeCents: number;
  remainingExpenseCents: number;
  projectedBalanceCents: number;
}

export interface FinanceGoalRow {
  id: string;
  userId: string;
  kind: FinanceGoalKind;
  name: string;
  targetCents: number;
  savedCents: number;
  deadline: IsoDateTime | null;
  createdAt: IsoDateTime;
}

export interface FinanceSummary {
  month: string; // YYYY-MM
  settings: FinanceSettings;
  entries: FinanceEntryRow[];
  occurrences: FinanceOccurrence[];
  /** Todas as ocorrencias do mes, incluindo projected. */
  totals: FinanceTotals;
  /** So as que ja aconteceram. */
  actualTotals: FinanceTotals;
  goals: FinanceGoalRow[];
  accounts: FinanceAccountRow[];
  holdings: FinanceHoldingView[];
  balances: FinanceBalances;
  projection: FinanceProjection;
}

export interface FinanceAnalyticsBucket {
  /** YYYY-MM ou YYYY-MM-DD da segunda-feira. */
  key: string;
  /** Cortados a [from, to]. */
  start: DateKey;
  end: DateKey;
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  projectedIncomeCents: number;
  projectedExpenseCents: number;
  expensesByCategory: Record<string, number>;
}

export interface FinanceSubscription {
  entryId: string;
  note: string | null;
  amountCents: number;
  frequency: FinanceFrequency;
  monthlyCostCents: number;
  nextDate: DateKey | null;
  endDate: DateKey | null;
  accountId: string | null;
}

export interface FinanceAnalytics {
  granularity: AnalyticsGranularity;
  from: DateKey;
  to: DateKey;
  currency: string;
  totals: { incomeCents: number; expenseCents: number; netCents: number };
  series: FinanceAnalyticsBucket[];
  topCategories: {
    category: string;
    expenseCents: number;
    sharePercent: number;
  }[];
  /** Despesas SUBSCRIPTIONS que se repetem e ainda nao acabaram. */
  subscriptions: { items: FinanceSubscription[]; monthlyTotalCents: number };
  /** Fim do mes ATUAL (independente de from/to). */
  projection: FinanceProjection & { month: string };
}

export interface PriceRefreshResponse {
  updated: string[];
  failed: string[];
  holdings: FinanceHoldingView[];
}
