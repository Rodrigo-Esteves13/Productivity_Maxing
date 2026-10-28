import api from './client';

export type FinanceEntryKind = 'INCOME' | 'EXPENSE';
export type FinanceGoalKind = 'SAVINGS' | 'INVESTMENT' | 'WISHLIST' | 'LONG_TERM';

// Mesmas listas do backend (finance.constants.ts).
export const FINANCE_CATEGORIES = [
  'SALARY',
  'ALLOWANCE',
  'SCHOLARSHIP',
  'HOUSING',
  'FOOD',
  'TRANSPORT',
  'EDUCATION',
  'HEALTH',
  'SUBSCRIPTIONS',
  'LEISURE',
  'SAVINGS',
  'OTHER',
] as const;
export const FINANCE_CURRENCIES = ['EUR', 'USD', 'GBP', 'BRL', 'CHF', 'JPY', 'CNY', 'KRW'] as const;
export const FINANCE_GOAL_KINDS: FinanceGoalKind[] = ['SAVINGS', 'INVESTMENT', 'WISHLIST', 'LONG_TERM'];

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
}

export interface FinanceGoal {
  id: string;
  kind: FinanceGoalKind;
  name: string;
  targetCents: number;
  savedCents: number;
  deadline: string | null;
}

export interface FinanceSummary {
  month: string;
  settings: FinanceSettings;
  entries: FinanceEntry[];
  totals: {
    incomeCents: number;
    expenseCents: number;
    netCents: number;
    leisureCents: number;
    expensesByCategory: Record<string, number>;
  };
  goals: FinanceGoal[];
}

export interface FinanceEntryInput {
  kind: FinanceEntryKind;
  amountCents: number;
  category: string;
  note?: string;
  /** YYYY-MM-DD */
  date: string;
  recurring?: boolean;
}

export interface FinanceGoalInput {
  kind: FinanceGoalKind;
  name: string;
  targetCents: number;
  savedCents?: number;
  deadline?: string | null;
}

export const getFinance = async (month: string): Promise<FinanceSummary> =>
  (await api.get<FinanceSummary>('/finance', { params: { month } })).data;

export const updateFinanceSettings = async (changes: Partial<FinanceSettings>): Promise<FinanceSettings> =>
  (await api.put<FinanceSettings>('/finance/settings', changes)).data;

export const createFinanceEntry = async (input: FinanceEntryInput): Promise<FinanceEntry> =>
  (await api.post<FinanceEntry>('/finance/entries', input)).data;

export const deleteFinanceEntry = async (id: string): Promise<void> => {
  await api.delete(`/finance/entries/${encodeURIComponent(id)}`);
};

export const createFinanceGoal = async (input: FinanceGoalInput): Promise<FinanceGoal> =>
  (await api.post<FinanceGoal>('/finance/goals', input)).data;

export const updateFinanceGoal = async (
  id: string,
  changes: Partial<Omit<FinanceGoalInput, 'kind'>>,
): Promise<FinanceGoal> => (await api.patch<FinanceGoal>(`/finance/goals/${encodeURIComponent(id)}`, changes)).data;

export const deleteFinanceGoal = async (id: string): Promise<void> => {
  await api.delete(`/finance/goals/${encodeURIComponent(id)}`);
};
