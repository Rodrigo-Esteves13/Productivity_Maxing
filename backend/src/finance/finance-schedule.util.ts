// Ocorrencias de entradas que se repetem (salario, renda, subscricoes).
// Puro: sem Prisma nem relogio. Todas as datas sao meia-noite UTC do dia de
// Lisboa (o mesmo formato de FinanceEntry.date, ver common/date-key.util).
//
// Dias uteis = segunda a sexta. NAO ha calendario de feriados: um salario
// "primeiro dia util" que caia num feriado nacional aparece nesse feriado.

import { FinanceFrequency, FinancePayDayRule } from '@prisma/client';
import { addUtcDays } from '../common/date-key.util';
import { MS_PER_DAY } from '../common/time.constants';
import {
  MAX_OCCURRENCES_PER_RULE,
  OCCURRENCE_REASONS,
  type OccurrenceReason,
} from './finance.constants';

export interface RecurrenceRule {
  /** Primeira ocorrencia possivel. */
  date: Date;
  frequency: FinanceFrequency | null;
  /** Legado: true sem frequency = MONTHLY no dia de `date`. */
  recurring?: boolean;
  payDayRule: FinancePayDayRule | null;
  payDay: number | null;
  /** Ultimo dia (inclusive) com ocorrencias (da ancora, ver abaixo). */
  endDate: Date | null;
  /** As primeiras N ocorrencias (contadas desde `date`) nao contam. */
  skipFirstOccurrences?: number;
  /** So MONTHLY: o mes M (ancora) paga no mes M+N. */
  paidInArrearsMonths?: number;
}

/** Regra com valor e retencao, para materializar ocorrencias. */
export interface ScheduleRule extends RecurrenceRule {
  amountCents: number;
  /** Retido na primeira ocorrencia e devolvido em endDate (so com repeticao). */
  withheldCents?: number | null;
}

export interface ScheduledOccurrence {
  date: Date;
  amountCents: number;
  reason: OccurrenceReason;
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

// Uma ocorrencia tem uma ancora (o dia "de trabalho", que `date`, endDate e
// skipFirstOccurrences filtram) e o dia em que o dinheiro chega. So diferem
// com paidInArrearsMonths.
interface Slot {
  anchor: Date;
  pay: Date;
}

const arrearsOf = (rule: RecurrenceRule) =>
  resolveFrequency(rule) === FinanceFrequency.MONTHLY
    ? (rule.paidInArrearsMonths ?? 0)
    : 0;

const sameDay = (d: Date): Slot => ({ anchor: d, pay: d });

const anchorAllowed = (rule: RecurrenceRule, d: Date) =>
  d >= rule.date && (!rule.endDate || d <= rule.endDate);

// Candidatos aproximados; scheduleInRange filtra por intervalo e fim.
type Candidates = (rule: RecurrenceRule, from: Date, to: Date) => Slot[];

const monthlyCandidates: Candidates = (rule, from, to) => {
  const pick = PAY_DAY_RULES[rule.payDayRule ?? FinancePayDayRule.FIXED_DAY];
  const lag = arrearsOf(rule);
  const at = (i: number) => pick(Math.floor(i / MONTHS), i % MONTHS, rule);
  // -1: com NEXT_MONTH a ocorrencia do mes anterior cai dentro de `from`.
  const first = Math.max(monthIndex(rule.date), monthIndex(from) - 1 - lag);
  const last = Math.min(monthIndex(to) - lag, first + MAX_OCCURRENCES_PER_RULE);
  const out: Slot[] = [];
  for (let i = first; i <= last; i++) {
    out.push({ anchor: at(i), pay: at(i + lag) });
  }
  return out;
};

const weeklyCandidates: Candidates = (rule, from, to) => {
  const stepMs = DAYS_PER_WEEK * MS_PER_DAY;
  const skip = Math.max(
    0,
    Math.ceil((from.getTime() - rule.date.getTime()) / stepMs),
  );
  const out: Slot[] = [];
  for (let k = skip; out.length < MAX_OCCURRENCES_PER_RULE; k++) {
    const d = addUtcDays(rule.date, k * DAYS_PER_WEEK);
    if (d >= to) break;
    out.push(sameDay(d));
  }
  return out;
};

const yearlyCandidates: Candidates = (rule, from, to) => {
  const month = rule.date.getUTCMonth();
  const day = rule.date.getUTCDate();
  const first = Math.max(rule.date.getUTCFullYear(), from.getUTCFullYear());
  const out: Slot[] = [];
  for (let y = first; y <= to.getUTCFullYear(); y++) {
    out.push(sameDay(clampedDay(y, month, day)));
  }
  return out;
};

const CANDIDATES: Record<FinanceFrequency, Candidates> = {
  WEEKLY: weeklyCandidates,
  MONTHLY: monthlyCandidates,
  YEARLY: yearlyCandidates,
};

// Teto de dias de um periodo: chega para a janela da n-esima ocorrencia.
const PERIOD_MAX_DAYS: Record<FinanceFrequency, number> = {
  WEEKLY: DAYS_PER_WEEK,
  MONTHLY: 31,
  YEARLY: 366,
};
// Folga de periodos na janela (o primeiro mes pode nao contar).
const SLOT_WINDOW_SLACK = 2;

/** n-esima ocorrencia (0 = primeira) contada desde `date`, ou null. */
function nthSlot(rule: RecurrenceRule, n: number): Slot | null {
  const frequency = resolveFrequency(rule);
  if (!frequency)
    return n === 0 && anchorAllowed(rule, rule.date)
      ? sameDay(rule.date)
      : null;
  const periods = n + SLOT_WINDOW_SLACK + arrearsOf(rule);
  const to = addUtcDays(rule.date, periods * PERIOD_MAX_DAYS[frequency]);
  const slots = CANDIDATES[frequency](rule, rule.date, to).filter((s) =>
    anchorAllowed(rule, s.anchor),
  );
  return slots[n] ?? null;
}

/** Dia em que chega a primeira ocorrencia da regra (ignora o skip). */
export function firstPayDate(rule: RecurrenceRule): Date | null {
  return nthSlot(rule, 0)?.pay ?? null;
}

/**
 * Ocorrencias de uma regra com o dia de pagamento em [from, to) (to
 * exclusivo), por ordem. A ancora nunca e antes de `date` nem depois de
 * `endDate` (inclusive); as primeiras skipFirstOccurrences nao contam.
 * Retencao (withheldCents, so com repeticao): a primeira ocorrencia da
 * regra (mesmo que saltada) paga amountCents - withheldCents (minimo 0) e
 * em endDate ha uma ocorrencia extra de withheldCents. Sem endDate nada e
 * devolvido. Uma entrada sem frequencia tem uma so ocorrencia, em `date`.
 */
export function scheduleInRange(
  rule: ScheduleRule,
  from: Date,
  to: Date,
): ScheduledOccurrence[] {
  const frequency = resolveFrequency(rule);
  const inRange = (d: Date) => d >= from && d < to;
  const regular = (d: Date): ScheduledOccurrence => ({
    date: d,
    amountCents: rule.amountCents,
    reason: OCCURRENCE_REASONS.REGULAR,
  });
  if (!frequency) {
    return inRange(rule.date) && anchorAllowed(rule, rule.date)
      ? [regular(rule.date)]
      : [];
  }
  const skip = rule.skipFirstOccurrences ?? 0;
  const start = skip > 0 ? nthSlot(rule, skip)?.anchor : rule.date;
  const withheld = rule.withheldCents ?? 0;
  const first = withheld > 0 ? nthSlot(rule, 0) : null;
  const out = start
    ? CANDIDATES[frequency](rule, from, to)
        .filter(
          (s) =>
            inRange(s.pay) &&
            anchorAllowed(rule, s.anchor) &&
            s.anchor >= start,
        )
        .map((s) =>
          first && s.anchor.getTime() === first.anchor.getTime()
            ? {
                date: s.pay,
                amountCents: Math.max(0, rule.amountCents - withheld),
                reason: OCCURRENCE_REASONS.WITHHELD_FIRST,
              }
            : regular(s.pay),
        )
    : [];
  if (first && rule.endDate && inRange(rule.endDate)) {
    out.push({
      date: rule.endDate,
      amountCents: withheld,
      reason: OCCURRENCE_REASONS.WITHHELD_RELEASE,
    });
  }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** So as datas das ocorrencias normais (sem a devolucao da retencao). */
export function occurrencesInRange(
  rule: RecurrenceRule,
  from: Date,
  to: Date,
): Date[] {
  return scheduleInRange(
    { ...rule, amountCents: 0, withheldCents: null },
    from,
    to,
  ).map((o) => o.date);
}
