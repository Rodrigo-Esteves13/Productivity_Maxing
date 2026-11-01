// Ocorrencias de entradas que se repetem (salario, renda, subscricoes).
// Puro: sem Prisma nem relogio. Todas as datas sao meia-noite UTC do dia de
// Lisboa (o mesmo formato de FinanceEntry.date, ver common/date-key.util).
//
// Dias uteis = segunda a sexta. NAO ha calendario de feriados: um salario
// "primeiro dia util" que caia num feriado nacional aparece nesse feriado.

import { FinanceFrequency, FinancePayDayRule } from '@prisma/client';
import { addUtcDays } from '../common/date-key.util';
import { MS_PER_DAY } from '../common/time.constants';
import { MAX_OCCURRENCES_PER_RULE } from './finance.constants';

export interface RecurrenceRule {
  /** Primeira ocorrencia possivel. */
  date: Date;
  frequency: FinanceFrequency | null;
  /** Legado: true sem frequency = MONTHLY no dia de `date`. */
  recurring?: boolean;
  payDayRule: FinancePayDayRule | null;
  payDay: number | null;
  /** Ultimo dia (inclusive) com ocorrencias. */
  endDate: Date | null;
}

const DAYS_PER_WEEK = 7;
const SATURDAY = 6;
const SUNDAY = 0;
const FRIDAY = 5;
const MONTHS = 12;

const isBusinessDay = (d: Date) =>
  d.getUTCDay() !== SATURDAY && d.getUTCDay() !== SUNDAY;

const daysInMonth = (year: number, month: number) =>
  new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

const monthIndex = (d: Date) => d.getUTCFullYear() * MONTHS + d.getUTCMonth();

function walk(start: Date, step: number, accept: (d: Date) => boolean): Date {
  let d = start;
  while (!accept(d)) d = addUtcDays(d, step);
  return d;
}

const firstOfMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 1));
const lastOfMonth = (y: number, m: number) =>
  new Date(Date.UTC(y, m, daysInMonth(y, m)));
// Dia `day` do mes, cortado ao ultimo dia (31 em abril = 30, 29 fev = 28).
const clampedDay = (y: number, m: number, day: number) =>
  new Date(Date.UTC(y, m, Math.min(day, daysInMonth(y, m))));

/** Dia de pagamento dentro do mes (y, m) para cada regra. */
const PAY_DAY_RULES: Record<
  FinancePayDayRule,
  (y: number, m: number, rule: RecurrenceRule) => Date
> = {
  FIXED_DAY: (y, m, rule) =>
    clampedDay(y, m, rule.payDay ?? rule.date.getUTCDate()),
  FIRST_BUSINESS_DAY: (y, m) => walk(firstOfMonth(y, m), 1, isBusinessDay),
  // O mes "ancora" e o do trabalho; o dinheiro chega no mes seguinte.
  FIRST_BUSINESS_DAY_NEXT_MONTH: (y, m) =>
    walk(firstOfMonth(y, m + 1), 1, isBusinessDay),
  LAST_BUSINESS_DAY: (y, m) => walk(lastOfMonth(y, m), -1, isBusinessDay),
  LAST_FRIDAY: (y, m) =>
    walk(lastOfMonth(y, m), -1, (d) => d.getUTCDay() === FRIDAY),
};

/** frequency efetiva (resolve o boolean legado `recurring`). */
export function resolveFrequency(rule: {
  frequency: FinanceFrequency | null;
  recurring?: boolean;
}): FinanceFrequency | null {
  return rule.frequency ?? (rule.recurring ? FinanceFrequency.MONTHLY : null);
}

// Candidatos aproximados; occurrencesInRange filtra por intervalo e fim.
type Candidates = (rule: RecurrenceRule, from: Date, to: Date) => Date[];

const monthlyCandidates: Candidates = (rule, from, to) => {
  const pick = PAY_DAY_RULES[rule.payDayRule ?? FinancePayDayRule.FIXED_DAY];
  // -1: com NEXT_MONTH a ocorrencia do mes anterior cai dentro de `from`.
  const first = Math.max(monthIndex(rule.date), monthIndex(from) - 1);
  const last = Math.min(monthIndex(to), first + MAX_OCCURRENCES_PER_RULE);
  const out: Date[] = [];
  for (let i = first; i <= last; i++) {
    out.push(pick(Math.floor(i / MONTHS), i % MONTHS, rule));
  }
  return out;
};

const weeklyCandidates: Candidates = (rule, from, to) => {
  const stepMs = DAYS_PER_WEEK * MS_PER_DAY;
  const skip = Math.max(
    0,
    Math.ceil((from.getTime() - rule.date.getTime()) / stepMs),
  );
  const out: Date[] = [];
  for (let k = skip; out.length < MAX_OCCURRENCES_PER_RULE; k++) {
    const d = addUtcDays(rule.date, k * DAYS_PER_WEEK);
    if (d >= to) break;
    out.push(d);
  }
  return out;
};

const yearlyCandidates: Candidates = (rule, from, to) => {
  const month = rule.date.getUTCMonth();
  const day = rule.date.getUTCDate();
  const first = Math.max(rule.date.getUTCFullYear(), from.getUTCFullYear());
  const out: Date[] = [];
  for (let y = first; y <= to.getUTCFullYear(); y++) {
    out.push(clampedDay(y, month, day));
  }
  return out;
};

const CANDIDATES: Record<FinanceFrequency, Candidates> = {
  WEEKLY: weeklyCandidates,
  MONTHLY: monthlyCandidates,
  YEARLY: yearlyCandidates,
};

/**
 * Datas das ocorrencias de uma regra em [from, to) (to exclusivo), por
 * ordem. Nunca antes de `date` nem depois de `endDate` (inclusive). Uma
 * entrada sem frequencia tem uma so ocorrencia, em `date`.
 */
export function occurrencesInRange(
  rule: RecurrenceRule,
  from: Date,
  to: Date,
): Date[] {
  const frequency = resolveFrequency(rule);
  const candidates = frequency
    ? CANDIDATES[frequency](rule, from, to)
    : [rule.date];
  return candidates.filter(
    (d) =>
      d >= from &&
      d < to &&
      d >= rule.date &&
      (!rule.endDate || d <= rule.endDate),
  );
}
