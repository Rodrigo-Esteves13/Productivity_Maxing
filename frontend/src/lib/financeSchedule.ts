// Pre-visualizacao local das proximas ocorrencias de uma regra (formulario de
// salario). Espelha backend/src/finance/finance-schedule.util.ts (dias uteis =
// segunda a sexta, sem feriados). E uma estimativa: o backend e a fonte final.
import type { FinanceFrequency, FinancePayDayRule, OccurrenceReason } from '../api/financeService';

export interface PreviewRule {
  /** YYYY-MM-DD da primeira data. */
  date: string;
  frequency: FinanceFrequency;
  payDayRule: FinancePayDayRule | null;
  payDay: number | null;
  /** YYYY-MM-DD ou null. */
  endDate: string | null;
  skipFirstOccurrences: number;
  paidInArrearsMonths: number;
  amountCents: number;
  withheldCents: number;
}

export interface PreviewOccurrence {
  date: string;
  amountCents: number;
  reason: OccurrenceReason;
}

const MONTHS = 12;
const SUNDAY = 0;
const SATURDAY = 6;
const FRIDAY = 5;
const DAYS_PER_WEEK = 7;
const MAX_SLOTS = 1200;
const MS_PER_DAY = 86_400_000;

const parseKey = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const toKey = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * MS_PER_DAY);
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
const isBusinessDay = (d: Date) => d.getUTCDay() !== SATURDAY && d.getUTCDay() !== SUNDAY;
const walk = (start: Date, step: number, accept: (d: Date) => boolean) => {
  let d = start;
  while (!accept(d)) d = addDays(d, step);
  return d;
};
const clamped = (y: number, m: number, day: number) => new Date(Date.UTC(y, m, Math.min(day, daysInMonth(y, m))));

const PAY_RULES: Record<FinancePayDayRule, (y: number, m: number, rule: PreviewRule) => Date> = {
  FIXED_DAY: (y, m, rule) => clamped(y, m, rule.payDay ?? parseKey(rule.date).getUTCDate()),
  FIRST_BUSINESS_DAY: (y, m) => walk(new Date(Date.UTC(y, m, 1)), 1, isBusinessDay),
  FIRST_BUSINESS_DAY_NEXT_MONTH: (y, m) => walk(new Date(Date.UTC(y, m + 1, 1)), 1, isBusinessDay),
  LAST_BUSINESS_DAY: (y, m) => walk(new Date(Date.UTC(y, m, daysInMonth(y, m))), -1, isBusinessDay),
  LAST_FRIDAY: (y, m) => walk(new Date(Date.UTC(y, m, daysInMonth(y, m))), -1, (d) => d.getUTCDay() === FRIDAY),
};

interface Slot {
  anchor: Date;
  pay: Date;
}

function slotAt(rule: PreviewRule, start: Date, i: number): Slot {
  if (rule.frequency === 'WEEKLY') {
    const d = addDays(start, i * DAYS_PER_WEEK);
    return { anchor: d, pay: d };
  }
  if (rule.frequency === 'YEARLY') {
    const d = clamped(start.getUTCFullYear() + i, start.getUTCMonth(), start.getUTCDate());
    return { anchor: d, pay: d };
  }
  const pick = PAY_RULES[rule.payDayRule ?? 'FIXED_DAY'];
  const base = start.getUTCFullYear() * MONTHS + start.getUTCMonth() + i;
  const at = (n: number) => pick(Math.floor(n / MONTHS), n % MONTHS, rule);
  return { anchor: at(base), pay: at(base + rule.paidInArrearsMonths) };
}

/** Proximas `count` ocorrencias com dia de pagamento a partir de `today` (YYYY-MM-DD). */
export function previewOccurrences(rule: PreviewRule, today: string, count: number): PreviewOccurrence[] {
  const start = parseKey(rule.date);
  const end = rule.endDate ? parseKey(rule.endDate) : null;
  const slots: Slot[] = [];
  // Ocorrencias contadas (depois do skip) com pagamento a partir de hoje.
  let upcoming = 0;
  for (let i = 0; i < MAX_SLOTS && upcoming < count; i++) {
    const slot = slotAt(rule, start, i);
    if (end && slot.anchor > end) break;
    // Com NEXT_MONTH a ancora do primeiro mes pode ser antes de `date`: so conta depois.
    if (slot.anchor < start) continue;
    slots.push(slot);
    if (slots.length > rule.skipFirstOccurrences && toKey(slot.pay) >= today) upcoming++;
  }
  const out: PreviewOccurrence[] = slots.slice(rule.skipFirstOccurrences).map((slot, idx) => {
    const isFirstOfRule = rule.skipFirstOccurrences + idx === 0;
    return isFirstOfRule && rule.withheldCents > 0
      ? { date: toKey(slot.pay), amountCents: Math.max(0, rule.amountCents - rule.withheldCents), reason: 'WITHHELD_FIRST' as const }
      : { date: toKey(slot.pay), amountCents: rule.amountCents, reason: 'REGULAR' as const };
  });
  if (end && rule.withheldCents > 0 && slots.length > 0) {
    out.push({ date: toKey(end), amountCents: rule.withheldCents, reason: 'WITHHELD_RELEASE' });
  }
  return out
    .filter((o) => o.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, count);
}
