import api from './client';

export type FinanceEntryKind = 'INCOME' | 'EXPENSE';
export type FinanceGoalKind = 'SAVINGS' | 'INVESTMENT' | 'WISHLIST' | 'LONG_TERM';
export type FinanceFrequency = 'WEEKLY' | 'MONTHLY' | 'YEARLY';
export type FinancePayDayRule =
  | 'FIXED_DAY'
  | 'FIRST_BUSINESS_DAY'
  | 'FIRST_BUSINESS_DAY_NEXT_MONTH'
  | 'LAST_BUSINESS_DAY'
  | 'LAST_FRIDAY';
export type FinanceAccountType = 'BANK' | 'LIVE' | 'INVESTMENT' | 'CRYPTO' | 'CASH' | 'OTHER';
export type FinanceBucket = FinanceAccountType | 'UNASSIGNED';
export type AnalyticsGranularity = 'week' | 'month';
export type FinanceInterestKind = 'NONE' | 'SIMPLE' | 'MONTHLY_COMPOUND';
export type GoalPlanStatus = 'ON_TRACK' | 'AT_RISK' | 'UNREALISTIC' | 'NO_DEADLINE' | 'DONE';
export type GoalPlanSource = 'USER' | 'SUGGESTED';
export type OccurrenceReason = 'REGULAR' | 'WITHHELD_FIRST' | 'WITHHELD_RELEASE';

// Mesmas listas do backend (finance.constants.ts).
export const FINANCE_CATEGORIES = [
  'SALARY',
  'ALLOWANCE',
  'SCHOLARSHIP',
  'HOUSING',
  'FOOD',
  'GROCERIES',
  'CAFE',
  'DINING',
  'SHOPPING',
  'TRANSPORT',
  'EDUCATION',
  'HEALTH',
  'SUBSCRIPTIONS',
  'LEISURE',
  'SAVINGS',
  'INVESTING',
  'CRYPTO',
  'OTHER',
] as const;
export const FINANCE_CURRENCIES = ['EUR', 'USD', 'GBP', 'BRL', 'CHF', 'JPY', 'CNY', 'KRW'] as const;
export const FINANCE_GOAL_KINDS: FinanceGoalKind[] = ['SAVINGS', 'INVESTMENT', 'WISHLIST', 'LONG_TERM'];
export const FINANCE_FREQUENCIES: FinanceFrequency[] = ['WEEKLY', 'MONTHLY', 'YEARLY'];
export const FINANCE_PAY_DAY_RULES: FinancePayDayRule[] = [
  'FIXED_DAY',
  'FIRST_BUSINESS_DAY',
  'FIRST_BUSINESS_DAY_NEXT_MONTH',
  'LAST_BUSINESS_DAY',
  'LAST_FRIDAY',
];
export const FINANCE_ACCOUNT_TYPES: FinanceAccountType[] = ['BANK', 'LIVE', 'INVESTMENT', 'CRYPTO', 'CASH', 'OTHER'];
export const FINANCE_BUCKETS: FinanceBucket[] = [...FINANCE_ACCOUNT_TYPES, 'UNASSIGNED'];
export const FINANCE_MIN_PAY_DAY = 1;
export const FINANCE_MAX_PAY_DAY = 31;
export const FINANCE_NOTE_MAX_LENGTH = 120;
export const FINANCE_ACCOUNT_NAME_MAX_LENGTH = 60;
export const FINANCE_SYMBOL_MAX_LENGTH = 20;
export const HTTP_TOO_MANY_REQUESTS = 429;
export const HTTP_CONFLICT = 409;
export const IDEMPOTENCY_HEADER = 'Idempotency-Key';
export const FINANCE_INTEREST_KINDS: FinanceInterestKind[] = ['NONE', 'SIMPLE', 'MONTHLY_COMPOUND'];
export const FINANCE_GOAL_STATUSES: GoalPlanStatus[] = ['ON_TRACK', 'AT_RISK', 'UNREALISTIC', 'NO_DEADLINE', 'DONE'];
export const FINANCE_MAX_ARREARS_MONTHS = 3;
export const FINANCE_MAX_SKIP_OCCURRENCES = 60;
export const FINANCE_DEBTOR_NAME_MAX_LENGTH = 80;
export const FINANCE_MAX_RATE_PCT = 100;

// Valores sempre em centimos.
export interface FinanceSettings {
  currency: string;
  balanceCents: number;
  monthlyBudgetCents: number | null;
  leisureBudgetCents: number | null;
}

export interface FinanceEntry {
  id: string;
  kind: FinanceEntryKind;
  amountCents: number;
  category: string;
  note: string | null;
  date: string;
  recurring: boolean;
  frequency: FinanceFrequency | null;
  payDayRule: FinancePayDayRule | null;
  payDay: number | null;
  endDate: string | null;
  accountId: string | null;
  skipFirstOccurrences: number;
  paidInArrearsMonths: number;
  withheldCents: number | null;
  isOwed: boolean;
  debtorName: string | null;
  expectedDate: string | null;
  latePaymentRiskPct: number | null;
  /** Decimal do Prisma: vem como texto ("4.5"). */
  interestRatePct: string | null;
  interestKind: FinanceInterestKind | null;
  receivedAt: string | null;
}

export interface FinanceOccurrence {
  entryId: string;
  /** YYYY-MM-DD */
  date: string;
  kind: FinanceEntryKind;
  amountCents: number;
  category: string;
  note: string | null;
  accountId: string | null;
  frequency: FinanceFrequency | null;
  /** true = ainda nao aconteceu. */
  projected: boolean;
  reason: OccurrenceReason;
}

export interface FinanceGoal {
  id: string;
  kind: FinanceGoalKind;
  name: string;
  targetCents: number;
  savedCents: number;
  deadline: string | null;
  monthlyPlanCents: number | null;
}

export interface FinanceTotals {
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  leisureCents: number;
  expensesByCategory: Record<string, number>;
}

export interface FinanceAccount {
  id: string;
  name: string;
  type: FinanceAccountType;
  balanceCents: number;
  currency: string | null;
}

export interface FinanceHolding {
  id: string;
  accountId: string | null;
  symbol: string;
  name: string;
  /** Texto decimal com 6 casas. */
  quantity: string;
  lastPriceCents: number | null;
  priceCurrency: string | null;
  priceUpdatedAt: string | null;
  costBasisCents: number | null;
  valueCents: number | null;
  gainCents: number | null;
  gainPercent: number | null;
  fullSharePriceCents: number | null;
  /** quantidade x 100. */
  percentOfFullShare: number;
  bucket: FinanceAccountType;
}

export interface FinanceBalances {
  currency: string;
  totalCents: number;
  cashCents: number;
  holdingsValueCents: number;
  byType: Record<FinanceBucket, number>;
  otherCurrencies: Record<string, number>;
  investments: { valueCents: number; costBasisCents: number; gainCents: number };
}

export interface FinanceProjection {
  untilDate: string;
  balanceCents: number;
  remainingIncomeCents: number;
  remainingExpenseCents: number;
  projectedBalanceCents: number;
}

export interface SurplusEstimate {
  monthlyCents: number;
  source: 'HISTORY' | 'RECURRING';
  monthsOfData: number;
  lowConfidence: boolean;
}

export interface FinanceGoalPlan {
  goalId: string;
  remainingCents: number;
  monthsLeft: number | null;
  requiredMonthlyCents: number | null;
  monthlyPlanCents: number | null;
  suggestedMonthlyCents: number;
  plannedMonthlyCents: number;
  planSource: GoalPlanSource;
  projectedCompletionDate: string | null;
  overdue: boolean;
  status: GoalPlanStatus;
}

export interface FinanceGoalPlanSummary {
  surplus: SurplusEstimate;
  availableMonthlyCents: number;
  totalRequiredMonthlyCents: number;
  totalPlannedMonthlyCents: number;
  allocationRealistic: boolean;
  planRealistic: boolean;
  shortfallCents: number;
  suggestedSplit: { goalId: string; suggestedMonthlyCents: number }[];
  overdueGoalIds: string[];
}

export interface FinanceHeldByEmployer {
  totalCents: number;
  items: { entryId: string; note: string | null; withheldCents: number; since: string; releaseDate: string | null }[];
}

export interface FinanceOwedItem {
  entryId: string;
  debtorName: string | null;
  note: string | null;
  principalCents: number;
  since: string;
  expectedDate: string | null;
  interestKind: FinanceInterestKind;
  interestRatePct: number | null;
  latePaymentRiskPct: number;
  interestToDateCents: number;
  valueTodayCents: number;
  dueValueCents: number;
  expectedValueCents: number;
  overdue: boolean;
  daysLate: number;
  lateScenario: { date: string; valueCents: number } | null;
}

export interface FinanceOwed {
  items: FinanceOwedItem[];
  totalOwedCents: number;
  totalRiskWeightedCents: number;
  overdueCount: number;
}

export interface FinanceSummary {
  month: string;
  settings: FinanceSettings;
  entries: FinanceEntry[];
  occurrences: FinanceOccurrence[];
  totals: FinanceTotals;
  actualTotals: FinanceTotals;
  goals: FinanceGoal[];
  accounts: FinanceAccount[];
  holdings: FinanceHolding[];
  balances: FinanceBalances;
  projection: FinanceProjection;
  /** Linha separada: nunca somar a `projection`. */
  projectionWithOwed: FinanceProjection & { owedRiskWeightedCents: number };
  owed: FinanceOwed;
  heldByEmployer: FinanceHeldByEmployer;
  goalPlans: FinanceGoalPlan[];
  goalPlanSummary: FinanceGoalPlanSummary;
}

export interface FinanceAnalyticsBucket {
  key: string;
  start: string;
  end: string;
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
  nextDate: string | null;
  endDate: string | null;
  accountId: string | null;
}

export interface FinanceAnalytics {
  granularity: AnalyticsGranularity;
  from: string;
  to: string;
  currency: string;
  totals: { incomeCents: number; expenseCents: number; netCents: number };
  series: FinanceAnalyticsBucket[];
  topCategories: { category: string; expenseCents: number; sharePercent: number }[];
  subscriptions: { items: FinanceSubscription[]; monthlyTotalCents: number };
  projection: FinanceProjection & { month: string };
}

export interface FinanceEntryInput {
  kind: FinanceEntryKind;
  amountCents: number;
  category: string;
  note?: string;
  /** YYYY-MM-DD */
  date: string;
  frequency?: FinanceFrequency | null;
  payDayRule?: FinancePayDayRule | null;
  payDay?: number | null;
  endDate?: string | null;
  accountId?: string | null;
  skipFirstOccurrences?: number;
  paidInArrearsMonths?: number;
  withheldCents?: number | null;
  isOwed?: boolean;
  debtorName?: string | null;
  expectedDate?: string | null;
  latePaymentRiskPct?: number | null;
  interestRatePct?: number | null;
  interestKind?: FinanceInterestKind | null;
  receivedAt?: string | null;
}

export interface FinanceAccountInput {
  name: string;
  type: FinanceAccountType;
  balanceCents?: number;
}

/** Manda quantity OU investedCents, nunca os dois. */
export interface FinanceHoldingInput {
  symbol: string;
  name?: string;
  accountId?: string | null;
  quantity?: string;
  investedCents?: number;
}

export type FinanceHoldingUpdate = Partial<Omit<FinanceHoldingInput, 'symbol'>>;

export interface FinanceGoalInput {
  kind: FinanceGoalKind;
  name: string;
  targetCents: number;
  savedCents?: number;
  deadline?: string | null;
  monthlyPlanCents?: number | null;
}

export interface PriceRefreshResult {
  updated: string[];
  failed: string[];
  holdings: FinanceHolding[];
}

export interface AnalyticsQuery {
  granularity: AnalyticsGranularity;
  from: string;
  to: string;
}

const enc = encodeURIComponent;

// Um uuid por intencao de criar; o backend devolve a mesma linha se repetir.
const idempotent = (key: string) => ({ headers: { [IDEMPOTENCY_HEADER]: key } });

export const getFinance = async (month: string): Promise<FinanceSummary> =>
  (await api.get<FinanceSummary>('/finance', { params: { month } })).data;

export const getFinanceAnalytics = async (query: AnalyticsQuery): Promise<FinanceAnalytics> =>
  (await api.get<FinanceAnalytics>('/finance/analytics', { params: query })).data;

export const updateFinanceSettings = async (changes: Partial<FinanceSettings>): Promise<FinanceSettings> =>
  (await api.put<FinanceSettings>('/finance/settings', changes)).data;

export const createFinanceEntry = async (input: FinanceEntryInput, requestId: string): Promise<FinanceEntry> =>
  (await api.post<FinanceEntry>('/finance/entries', input, idempotent(requestId))).data;

export const updateFinanceEntry = async (id: string, changes: Partial<FinanceEntryInput>): Promise<FinanceEntry> =>
  (await api.patch<FinanceEntry>(`/finance/entries/${enc(id)}`, changes)).data;

export const deleteFinanceEntry = async (id: string): Promise<void> => {
  await api.delete(`/finance/entries/${enc(id)}`);
};

export const createFinanceAccount = async (input: FinanceAccountInput, requestId: string): Promise<FinanceAccount> =>
  (await api.post<FinanceAccount>('/finance/accounts', input, idempotent(requestId))).data;

export const updateFinanceAccount = async (id: string, changes: Partial<FinanceAccountInput>): Promise<FinanceAccount> =>
  (await api.patch<FinanceAccount>(`/finance/accounts/${enc(id)}`, changes)).data;

export const deleteFinanceAccount = async (id: string): Promise<void> => {
  await api.delete(`/finance/accounts/${enc(id)}`);
};

export const createFinanceHolding = async (input: FinanceHoldingInput, requestId: string): Promise<FinanceHolding> =>
  (await api.post<FinanceHolding>('/finance/holdings', input, idempotent(requestId))).data;

export const updateFinanceHolding = async (id: string, changes: FinanceHoldingUpdate): Promise<FinanceHolding> => (await api.patch<FinanceHolding>(`/finance/holdings/${enc(id)}`, changes)).data;

export const deleteFinanceHolding = async (id: string): Promise<void> => {
  await api.delete(`/finance/holdings/${enc(id)}`);
};

export const refreshFinanceHoldings = async (): Promise<PriceRefreshResult> =>
  (await api.post<PriceRefreshResult>('/finance/holdings/refresh')).data;

export const createFinanceGoal = async (input: FinanceGoalInput, requestId: string): Promise<FinanceGoal> =>
  (await api.post<FinanceGoal>('/finance/goals', input, idempotent(requestId))).data;

export const updateFinanceGoal = async (id: string, changes: Partial<FinanceGoalInput>): Promise<FinanceGoal> => (await api.patch<FinanceGoal>(`/finance/goals/${enc(id)}`, changes)).data;

export const deleteFinanceGoal = async (id: string): Promise<void> => {
  await api.delete(`/finance/goals/${enc(id)}`);
};
