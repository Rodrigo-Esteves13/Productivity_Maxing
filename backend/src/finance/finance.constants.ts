// Limites do separador Finance. Valores em centimos.
export const MAX_AMOUNT_CENTS = 10_000_000_000; // 100 milhoes
export const MAX_FINANCE_ENTRIES_PER_USER = 5000;
export const MAX_FINANCE_GOALS_PER_USER = 100;
export const FINANCE_WRITES_PER_MINUTE = 60;
export const FINANCE_NOTE_MAX_LENGTH = 120;
export const FINANCE_GOAL_NAME_MAX_LENGTH = 80;

// Categorias fixas (o frontend traduz). LEISURE conta para o limite de lazer.
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

// Moedas aceites (ISO 4217); so muda a forma como o frontend mostra.
export const FINANCE_CURRENCIES = [
  'EUR',
  'USD',
  'GBP',
  'BRL',
  'CHF',
  'JPY',
  'CNY',
  'KRW',
] as const;
