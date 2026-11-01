// Dinheiro guardado em centimos (inteiros) e mostrado na moeda escolhida.

export function formatMoney(cents: number, currency: string, locale?: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

/** "12,50" ou "12.5" -> 1250. null se nao for um valor valido (>= 0). */
export function parseMoneyInput(value: string): number | null {
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}

/** Centimos para o valor de um campo de texto ("12.50"). */
export function centsToInput(cents: number | null): string {
  return cents === null ? '' : (cents / 100).toFixed(2);
}

/** YYYY-MM do mes local de `date`. */
export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftMonth(month: string, delta: number): string {
  const [year, index] = month.split('-').map(Number);
  return monthKey(new Date(year, index - 1 + delta, 1));
}

// Quantidade de uma posicao: texto decimal, ate 12 inteiros e 6 casas (igual ao backend).
const QUANTITY_PATTERN = /^\d{1,12}(\.\d{1,6})?$/;
const QUANTITY_MAX_DECIMALS = 6;
const PERCENT_MAX_DECIMALS = 1;
const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 1440;

/** "0,666152" ou "0.5" -> "0.666152" / "0.5". null se invalido ou zero. */
export function parseQuantity(value: string): string | null {
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.');
  return QUANTITY_PATTERN.test(normalized) && Number(normalized) > 0 ? normalized : null;
}

/** Quantidade para mostrar, na lingua da pessoa (sem zeros a mais). */
export function formatQuantity(quantity: string, locale?: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: QUANTITY_MAX_DECIMALS }).format(Number(quantity));
}

/** 66.6152 -> "66.6 %" (valor ja em percentagem, nao fracao). */
export function formatPercent(percent: number, locale?: string): string {
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: PERCENT_MAX_DECIMALS }).format(percent / 100);
}

/** "ha 5 minutos" a partir de um timestamp ISO. */
export function formatRelativeTime(iso: string, locale?: string, now: number = Date.now()): string {
  const minutes = Math.round((Date.parse(iso) - now) / MS_PER_MINUTE);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const abs = Math.abs(minutes);
  if (abs < MINUTES_PER_HOUR) return rtf.format(minutes, 'minute');
  if (abs < MINUTES_PER_DAY) return rtf.format(Math.round(minutes / MINUTES_PER_HOUR), 'hour');
  return rtf.format(Math.round(minutes / MINUTES_PER_DAY), 'day');
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Intervalo YYYY-MM-DD dos ultimos `months` meses ate ao fim do mes de `now` (inclusive). */
export function monthsRange(months: number, now: Date = new Date()): { from: string; to: string } {
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const key = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  return { from: key(start), to: key(end) };
}

/** Etiqueta curta de um balde do grafico: "set 2026" (mes) ou "7 set" (semana). */
export function formatBucketLabel(key: string, granularity: 'week' | 'month', locale?: string): string {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, month - 1, day ?? 1);
  return granularity === 'month'
    ? date.toLocaleDateString(locale, { month: 'short', year: '2-digit' })
    : date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}
