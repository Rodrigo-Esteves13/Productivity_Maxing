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
 * POST   /finance/goals                  body CreateFinanceGoalBody -> FinanceGoalRow
 * PATCH  /finance/goals/:id              body UpdateFinanceGoalBody -> FinanceGoalRow (CHANGED: kind, monthlyPlanCents)
 * DELETE /finance/goals/:id              -> 204
 *
 * Ronda 3 (fase 7, feedback): TUDO aditivo, nada removido.
 * - Idempotencia (duplo clique): os 4 POST de criacao (entries, accounts,
 *   holdings, goals) aceitam um uuid no header `Idempotency-Key` OU no
 *   campo `clientRequestId` do body (se vierem os dois tem de ser iguais,
 *   senao 400; header que nao e uuid = 400). Mesmo user + mesma chave nas
 *   ultimas 24h devolve a linha ja criada (mesmo status 201, mesma forma);
 *   chave reutilizada depois das 24h = 409. Pedidos simultaneos com a mesma
 *   chave criam uma so linha. Gerar uma chave nova por intencao de criar
 *   (por abertura do formulario), reutiliza-la nos retries.
 *   Os PATCH NAO aceitam clientRequestId (400 por campo desconhecido).
 * - Entradas: skipFirstOccurrences, paidInArrearsMonths, withheldCents,
 *   e o bloco "devem-me dinheiro" (isOwed...). Ver CreateFinanceEntryBody.
 * - Ocorrencias: novo campo `reason` (REGULAR | WITHHELD_FIRST |
 *   WITHHELD_RELEASE). amountCents ja vem com a retencao aplicada.
 * - GET /finance ganha: heldByEmployer, owed, projectionWithOwed, goalPlans,
 *   goalPlanSummary. Os planos vem no resumo (sem rota propria) porque usam
 *   as mesmas entradas; sao sempre calculados em relacao a HOJE, nao ao
 *   `month` pedido.
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
 * - Regras de salario (so com frequency):
 *   - skipFirstOccurrences N: as primeiras N ocorrencias, contadas desde
 *     `date`, nao contam (ex.: 1 = "ja recebi o deste mes"; `date` continua a
 *     ser a ancora). Funciona com WEEKLY/MONTHLY/YEARLY. 0..60.
 *   - paidInArrearsMonths N (so MONTHLY, 0..3): o trabalho do mes M e pago
 *     no mes M+N, com a mesma payDayRule. `date` e `endDate` filtram o mes
 *     de trabalho (ancora), por isso o ultimo salario chega depois de
 *     endDate. Nota: FIRST_BUSINESS_DAY_NEXT_MONTH ja e um atraso de 1; nao
 *     somar os dois sem querer.
 *   - withheldCents (so INCOME com repeticao): a PRIMEIRA ocorrencia da
 *     regra (mesmo que saltada por skipFirstOccurrences) paga
 *     amountCents - withheldCents (minimo 0, reason WITHHELD_FIRST). Em
 *     endDate ha uma ocorrencia extra de withheldCents (reason
 *     WITHHELD_RELEASE, projected como as outras). Sem endDate nada e
 *     devolvido; o valor aparece em heldByEmployer (NAO conta no saldo).
 *   - Mandar estes campos numa entrada sem a repeticao certa = 400. Mudar
 *     a entrada para uma vez (frequency null) limpa-os.
 * - Devem-me dinheiro (isOwed, so INCOME de uma vez):
 *   - Enquanto receivedAt e null NAO conta em nada: nem occurrences, nem
 *     totals, nem projection, nem analytics, nem saldo. So aparece em
 *     `owed` e em `projectionWithOwed`.
 *   - `date` = dia em que o dinheiro foi emprestado (inicio dos juros);
 *     expectedDate = prazo (obrigatorio se houver juros, nunca antes de date).
 *   - Juros: taxa anual em % (0..100, ate 3 casas). SIMPLE = linear em base
 *     365; MONTHLY_COMPOUND = capitaliza ao mes; taxa sem interestKind =
 *     SIMPLE. Os juros continuam a contar depois do prazo.
 *   - latePaymentRiskPct (0..100) e a estimativa da pessoa de NAO ser pago a
 *     tempo. expectedValueCents = (principal + juros ate ao prazo) x
 *     (1 - risco/100).
 *   - Marcar como recebido: PATCH /finance/entries/:id { receivedAt:
 *     "YYYY-MM-DD", amountCents?: valor recebido }. `date` passa a ser
 *     receivedAt e a entrada conta como entrada normal nesse dia (sai de
 *     `owed`). receivedAt nao pode ser antes de `date`.
 *   - Campos de divida sem isOwed = 400; isOwed false limpa-os.
 * - Planos dos objetivos (pura aritmetica, sem conselhos):
 *   - remaining = max(0, target - saved). monthsLeft = meses de calendario
 *     ate ao prazo arredondado para cima (minimo 1 se no futuro; 0 se hoje
 *     ou passado = overdue). requiredMonthlyCents = ceil(remaining /
 *     monthsLeft) (overdue: tudo o que falta).
 *   - Excedente: media mensal (entradas - saidas) dos ultimos 3 meses
 *     COMPLETOS com movimentos; despesas SAVINGS/INVESTING/CRYPTO nao
 *     contam (sao o dinheiro que vai para objetivos). Com menos de 2 meses
 *     com dados: soma das regras que se repetem ativas (custo mensal
 *     equivalente) e lowConfidence true.
 *   - Reparticao sugerida: excedente (minimo 0) primeiro pelos prazos mais
 *     proximos ate ao necessario, depois o resto em partes iguais pelos sem
 *     prazo (ate ao que lhes falta). Overdue ficam fora.
 *   - plannedMonthlyCents = monthlyPlanCents (da pessoa) ou a sugestao.
 *     projectedCompletionDate = hoje + ceil(remaining / planned) meses.
 *   - status: DONE (nada falta) > NO_DEADLINE > UNREALISTIC (overdue ou
 *     required > excedente inteiro) > AT_RISK (planned < required) >
 *     ON_TRACK.
 * - Precos: cron de hora a hora (Yahoo Finance). Falhas mantem o ultimo
 *   preco; priceUpdatedAt diz de quando e.
 */

import type {
  FinanceAccountType,
  FinanceEntryKind,
  FinanceFrequency,
  FinanceGoalKind,
  FinanceInterestKind,
  FinancePayDayRule,
} from '@prisma/client';
import type {
  AnalyticsGranularity,
  FinanceCategory,
  GoalPlanSource,
  GoalPlanStatus,
  OccurrenceReason,
  SurplusSource,
} from './finance.constants';

type DateKey = string; // YYYY-MM-DD
type IsoDateTime = string;
type Bucket = FinanceAccountType | 'UNASSIGNED';
type Uuid = string;

/** Os 4 POST de criacao: alternativa ao header Idempotency-Key. */
export interface IdempotentBody {
  clientRequestId?: Uuid;
}

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

export interface CreateFinanceEntryBody extends IdempotentBody {
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
  /** 0..60, so com frequency. Omissao 0. */
  skipFirstOccurrences?: number;
  /** 0..3, so MONTHLY. Omissao 0. */
  paidInArrearsMonths?: number;
  /** 1..MAX, so INCOME com frequency. null = sem retencao. */
  withheldCents?: number | null;
  /** Devem-me dinheiro. So INCOME com frequency null. */
  isOwed?: boolean;
  debtorName?: string | null; // <= 80
  /** Prazo. Obrigatorio com juros. */
  expectedDate?: DateKey | null;
  /** 0..100 inteiro. */
  latePaymentRiskPct?: number | null;
  /** 0..100, ate 3 casas (4.5 = 4,5% ao ano). */
  interestRatePct?: number | null;
  interestKind?: FinanceInterestKind | null;
  /** Marcar como recebido (normalmente via PATCH). */
  receivedAt?: DateKey | null;
}

/** PATCH /finance/entries/:id. Sem clientRequestId. */
export type UpdateFinanceEntryBody = Partial<
  Omit<CreateFinanceEntryBody, 'clientRequestId'>
>;

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
  skipFirstOccurrences: number;
  paidInArrearsMonths: number;
  withheldCents: number | null;
  isOwed: boolean;
  debtorName: string | null;
  expectedDate: IsoDateTime | null;
  latePaymentRiskPct: number | null;
  /** Decimal do Prisma: vem como TEXTO ("4.5") ou null. */
  interestRatePct: string | null;
  interestKind: FinanceInterestKind | null;
  receivedAt: IsoDateTime | null;
  clientRequestId: Uuid | null;
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
  /** NEW. WITHHELD_FIRST = ja com a retencao descontada. */
  reason: OccurrenceReason;
}

export interface FinanceTotals {
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  leisureCents: number;
  expensesByCategory: Record<string, number>;
}

export interface CreateFinanceAccountBody extends IdempotentBody {
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
  clientRequestId: Uuid | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

/** PATCH /finance/accounts/:id. Sem clientRequestId. */
export type UpdateFinanceAccountBody = Partial<
  Omit<CreateFinanceAccountBody, 'clientRequestId'>
>;

/** Manda quantity OU investedCents (nunca os dois). */
export interface CreateFinanceHoldingBody extends IdempotentBody {
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

/** Sem symbol nem clientRequestId. investedCents usa priceCents ou o ultimo preco guardado. */
export type UpdateFinanceHoldingBody = Partial<
  Omit<CreateFinanceHoldingBody, 'symbol' | 'clientRequestId'>
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
  clientRequestId: Uuid | null;
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

export interface CreateFinanceGoalBody extends IdempotentBody {
  kind: FinanceGoalKind;
  name: string; // 1..80
  targetCents: number; // 1..MAX
  savedCents?: number; // 0..MAX
  deadline?: DateKey | null;
  /** NEW. Quanto a pessoa planeia por mes (0..MAX). null = usa a sugestao. */
  monthlyPlanCents?: number | null;
}

/** NEW: tudo editavel, incluindo kind e monthlyPlanCents (null limpa). */
export type UpdateFinanceGoalBody = Partial<
  Omit<CreateFinanceGoalBody, 'clientRequestId'>
>;

export interface FinanceGoalRow {
  id: string;
  userId: string;
  kind: FinanceGoalKind;
  name: string;
  targetCents: number;
  savedCents: number;
  deadline: IsoDateTime | null;
  monthlyPlanCents: number | null;
  clientRequestId: Uuid | null;
  createdAt: IsoDateTime;
}

export interface SurplusEstimate {
  /** Pode ser negativo. */
  monthlyCents: number;
  source: SurplusSource; // HISTORY | RECURRING
  monthsOfData: number; // 0..3
  lowConfidence: boolean;
}

export interface FinanceGoalPlan {
  goalId: string;
  remainingCents: number;
  /** null = sem prazo; 0 = prazo hoje ou passado. */
  monthsLeft: number | null;
  requiredMonthlyCents: number | null;
  monthlyPlanCents: number | null;
  suggestedMonthlyCents: number;
  plannedMonthlyCents: number;
  planSource: GoalPlanSource; // USER | SUGGESTED
  projectedCompletionDate: DateKey | null;
  overdue: boolean;
  status: GoalPlanStatus; // ON_TRACK | AT_RISK | UNREALISTIC | NO_DEADLINE | DONE
}

export interface FinanceGoalPlanSummary {
  surplus: SurplusEstimate;
  availableMonthlyCents: number;
  totalRequiredMonthlyCents: number;
  totalPlannedMonthlyCents: number;
  /** totalRequired <= available. */
  allocationRealistic: boolean;
  /** totalPlanned (so planos da pessoa) <= available. */
  planRealistic: boolean;
  shortfallCents: number;
  /** Por urgencia (prazo), depois os sem prazo. */
  suggestedSplit: { goalId: string; suggestedMonthlyCents: number }[];
  overdueGoalIds: string[];
}

/** Dinheiro retido pelo empregador e ainda nao devolvido. Fora do saldo. */
export interface FinanceHeldByEmployer {
  totalCents: number;
  items: {
    entryId: string;
    note: string | null;
    withheldCents: number;
    /** Dia da primeira ocorrencia (quando foi retido). */
    since: DateKey;
    /** endDate da regra; null = sem data de devolucao. */
    releaseDate: DateKey | null;
  }[];
}

export interface FinanceOwedItem {
  entryId: string;
  debtorName: string | null;
  note: string | null;
  principalCents: number;
  /** Dia do emprestimo (inicio dos juros). */
  since: DateKey;
  expectedDate: DateKey | null;
  /** Efetivo: taxa sem tipo = SIMPLE, sem taxa = NONE. */
  interestKind: FinanceInterestKind;
  interestRatePct: number | null;
  /** 0 quando nao foi escrito. */
  latePaymentRiskPct: number;
  /** Juros de since ate hoje (continuam depois do prazo). */
  interestToDateCents: number;
  valueTodayCents: number;
  /** principal + juros ate expectedDate (sem prazo = valueToday). */
  dueValueCents: number;
  /** dueValue x (1 - risco/100). */
  expectedValueCents: number;
  overdue: boolean;
  daysLate: number;
  /** Valor se pagar 30 dias depois do prazo (ou de hoje, se ja atrasado). null sem prazo. */
  lateScenario: { date: DateKey; valueCents: number } | null;
}

export interface FinanceOwed {
  /** Dividas com receivedAt null, prazo mais proximo primeiro. */
  items: FinanceOwedItem[];
  /** Soma de valueTodayCents. */
  totalOwedCents: number;
  /** Soma de expectedValueCents. */
  totalRiskWeightedCents: number;
  overdueCount: number;
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
  /** Nunca inclui dividas por receber. */
  projection: FinanceProjection;
  /** NEW. projection + expectedValueCents das dividas com expectedDate <= untilDate (inclui atrasadas). */
  projectionWithOwed: FinanceProjection & { owedRiskWeightedCents: number };
  /** NEW */
  owed: FinanceOwed;
  /** NEW */
  heldByEmployer: FinanceHeldByEmployer;
  /** NEW. Mesma ordem de `goals`. */
  goalPlans: FinanceGoalPlan[];
  /** NEW */
  goalPlanSummary: FinanceGoalPlanSummary;
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
