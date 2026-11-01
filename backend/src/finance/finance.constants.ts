import { MS_PER_MINUTE, MS_PER_SECOND } from '../common/time.constants';

// Limites do separador Finance. Valores em centimos.
// Teto de uma coluna Int do Postgres (int4). Valores acima rebentavam a
// escrita com 500 ("integer out of range").
export const MAX_DB_INT = 2_147_483_647;
export const MAX_AMOUNT_CENTS = 2_000_000_000; // 20 milhoes, cabe num Int
export const MAX_FINANCE_ENTRIES_PER_USER = 5000;
export const MAX_FINANCE_GOALS_PER_USER = 100;
export const MAX_FINANCE_ACCOUNTS_PER_USER = 50;
export const MAX_FINANCE_HOLDINGS_PER_USER = 100;
export const FINANCE_WRITES_PER_MINUTE = 60;
export const FINANCE_NOTE_MAX_LENGTH = 120;
export const FINANCE_GOAL_NAME_MAX_LENGTH = 80;
export const FINANCE_ACCOUNT_NAME_MAX_LENGTH = 60;
export const FINANCE_HOLDING_NAME_MAX_LENGTH = 80;

// Categorias fixas (o frontend traduz). LEISURE conta para o limite de lazer.
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
export type FinanceCategory = (typeof FINANCE_CATEGORIES)[number];
export const LEISURE_CATEGORY: FinanceCategory = 'LEISURE';
export const SUBSCRIPTIONS_CATEGORY: FinanceCategory = 'SUBSCRIPTIONS';

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
export const DEFAULT_FINANCE_CURRENCY = 'EUR';

// Saldo antigo (FinanceSettings.balanceCents) passa para esta conta no
// primeiro GET /finance de quem ainda nao tem contas.
export const LEGACY_ACCOUNT_NAME = 'Main account';
// Balde do saldo antigo que ainda nao foi para nenhuma conta.
export const UNASSIGNED_BUCKET = 'UNASSIGNED';

// Regra FIXED_DAY: dia do mes (cortado ao ultimo dia quando o mes e curto).
export const MIN_PAY_DAY = 1;
export const MAX_PAY_DAY = 31;

// Custo mensal equivalente de uma subscricao semanal/anual.
export const WEEKS_PER_YEAR = 52;
export const MONTHS_PER_YEAR = 12;

// Analytics
export const ANALYTICS_GRANULARITIES = ['week', 'month'] as const;
export type AnalyticsGranularity = (typeof ANALYTICS_GRANULARITIES)[number];
export const DEFAULT_ANALYTICS_GRANULARITY: AnalyticsGranularity = 'month';
// Sem from/to: os ultimos N meses ate ao fim do mes atual.
export const DEFAULT_ANALYTICS_MONTHS = 6;
export const MAX_ANALYTICS_RANGE_DAYS = 731;
export const ANALYTICS_TOP_CATEGORIES = 5;
// Teto de ocorrencias materializadas por regra num pedido (uma regra semanal
// em 2 anos da ~105).
export const MAX_OCCURRENCES_PER_RULE = 400;

// Posicoes (holdings)
// Quantidade como texto decimal (ate 12 inteiros e 6 casas), sem floats.
export const QUANTITY_PATTERN = /^\d{1,12}(\.\d{1,6})?$/;
export const QUANTITY_DECIMALS = 6;
export const PERCENT_DECIMALS = 2;
export const PERCENT_SCALE = 100;
export const CENTS_PER_UNIT = 100;
// Simbolo aceite pelo fornecedor de cotacoes. Restrito para nao haver
// injecao no caminho do URL.
// Pelo menos uma letra/algarismo: ".." sozinho viraria um segmento de
// caminho relativo no URL.
export const QUOTE_SYMBOL_PATTERN = /^(?=.*[A-Z0-9])[A-Z0-9.\-=^]{1,20}$/;
export const QUOTE_SYMBOL_MAX_LENGTH = 20;
// Convencao do Yahoo para cripto: BASE-MOEDA (BTC-EUR). Sem conta ligada,
// estas posicoes contam no balde CRYPTO; as outras no INVESTMENT.
export const CRYPTO_SYMBOL_PATTERN = /^[A-Z0-9]{2,10}-[A-Z]{3}$/;

// Fornecedor de cotacoes: um unico host fixo (sem SSRF).
export const QUOTE_PROVIDER_BASE_URL =
  'https://query1.finance.yahoo.com/v8/finance/chart/';
export const QUOTE_TIMEOUT_MS = 8 * MS_PER_SECOND;
export const QUOTE_USER_AGENT = 'Mozilla/5.0 (compatible; PmaxingQuotes/1.0)';
export const QUOTE_CONCURRENCY = 4;
// Teto de simbolos distintos por execucao do cron.
export const MAX_SYMBOLS_PER_PRICE_RUN = 500;
// Um simbolo nao e pedido de novo ao fornecedor antes disto (refresh manual).
export const QUOTE_MIN_REFRESH_MS = 5 * MS_PER_MINUTE;
export const FINANCE_REFRESH_PER_MINUTE = 5;
// Moedas em subunidades no Yahoo (GBp = pence): divisor para a moeda base.
export const QUOTE_MINOR_UNIT_CURRENCIES: Record<
  string,
  { currency: string; divisor: number }
> = {
  GBp: { currency: 'GBP', divisor: 100 },
  GBX: { currency: 'GBP', divisor: 100 },
  ZAc: { currency: 'ZAR', divisor: 100 },
  ILA: { currency: 'ILS', divisor: 100 },
};
