// Planos dos objetivos: quanto falta, quanto por mes ate ao prazo e se o
// conjunto cabe no excedente medio. Puro (sem Prisma nem relogio). So
// aritmetica sobre o que a pessoa escreveu: nao e aconselhamento.

import { FinanceEntryKind, type FinanceFrequency } from '@prisma/client';
import { parseDateKey, toDateKey } from '../common/date-key.util';
import { monthKey, monthlyCostCents } from './finance-analytics.util';
import {
  GOAL_CONTRIBUTION_CATEGORIES,
  GOAL_PLAN_SOURCES,
  GOAL_PLAN_STATUSES,
  MIN_SURPLUS_HISTORY_MONTHS,
  MONTHS_PER_YEAR,
  SURPLUS_SOURCES,
  type GoalPlanSource,
  type GoalPlanStatus,
  type SurplusSource,
} from './finance.constants';

type Flow = { kind: FinanceEntryKind; amountCents: number; category: string };

export interface SurplusEstimate {
  /** Media mensal de entradas - saidas (sem as que vao para objetivos). */
  monthlyCents: number;
  source: SurplusSource;
  /** Meses da janela com pelo menos um movimento. */
  monthsOfData: number;
  /** Menos de MIN_SURPLUS_HISTORY_MONTHS meses com dados. */
  lowConfidence: boolean;
}

const isContribution = (category: string) =>
  (GOAL_CONTRIBUTION_CATEGORIES as readonly string[]).includes(category);

// Entrada soma, saida subtrai; saidas para objetivos nao contam.
const signed = (f: Flow) =>
  f.kind === FinanceEntryKind.INCOME
    ? f.amountCents
    : isContribution(f.category)
      ? 0
      : -f.amountCents;

/**
 * Excedente mensal medio. Com historico suficiente: media dos meses da
 * janela que tem movimentos (so os que ja aconteceram). Senao: regras que
 * se repetem (custo mensal equivalente), com lowConfidence.
 */
export function estimateSurplus(
  history: (Flow & { date: string; projected: boolean })[],
  monthKeys: string[],
  recurring: (Flow & { frequency: FinanceFrequency })[],
): SurplusEstimate {
  const byMonth = new Map<string, number>();
  for (const o of history) {
    const key = monthKey(parseDateKey(o.date));
    if (o.projected || !monthKeys.includes(key)) continue;
    byMonth.set(key, (byMonth.get(key) ?? 0) + signed(o));
  }
  const monthsOfData = byMonth.size;
  const lowConfidence = monthsOfData < MIN_SURPLUS_HISTORY_MONTHS;
  if (!lowConfidence) {
    const sum = [...byMonth.values()].reduce((a, b) => a + b, 0);
    return {
      monthlyCents: Math.round(sum / monthsOfData),
      source: SURPLUS_SOURCES.HISTORY,
      monthsOfData,
      lowConfidence,
    };
  }
  const monthlyCents = recurring.reduce(
    (sum, r) =>
      sum +
      signed({
        ...r,
        amountCents: monthlyCostCents(r.amountCents, r.frequency),
      }),
    0,
  );
  return {
    monthlyCents,
    source: SURPLUS_SOURCES.RECURRING,
    monthsOfData,
    lowConfidence,
  };
}

export interface GoalInput {
  id: string;
  targetCents: number;
  savedCents: number;
  deadline: Date | null;
  monthlyPlanCents: number | null;
  createdAt: Date;
}

export interface GoalPlan {
  goalId: string;
  remainingCents: number;
  /** null sem prazo; 0 = prazo hoje ou ja passou; senao minimo 1. */
  monthsLeft: number | null;
  /** ceil(remaining / monthsLeft); prazo passado = tudo o que falta. */
  requiredMonthlyCents: number | null;
  monthlyPlanCents: number | null;
  /** Parte do excedente atribuida a este objetivo (por urgencia). */
  suggestedMonthlyCents: number;
  /** monthlyPlanCents se existir, senao suggestedMonthlyCents. */
  plannedMonthlyCents: number;
  planSource: GoalPlanSource;
  /** YYYY-MM-DD a este ritmo; null se o ritmo for 0 ou ja estiver feito. */
  projectedCompletionDate: string | null;
  overdue: boolean;
  status: GoalPlanStatus;
}

export interface GoalPlanSummary {
  surplus: SurplusEstimate;
  /** max(0, surplus.monthlyCents). */
  availableMonthlyCents: number;
  /** Soma de requiredMonthlyCents dos objetivos com prazo no futuro. */
  totalRequiredMonthlyCents: number;
  /** Soma dos monthlyPlanCents escritos pela pessoa (objetivos por acabar). */
  totalPlannedMonthlyCents: number;
  allocationRealistic: boolean;
  planRealistic: boolean;
  /** max(0, totalRequired - available). */
  shortfallCents: number;
  /** Prazo mais proximo primeiro; depois os sem prazo, em partes iguais. */
  suggestedSplit: { goalId: string; suggestedMonthlyCents: number }[];
  overdueGoalIds: string[];
}

const daysInMonth = (y: number, m: number) =>
  new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

/** today + n meses, cortado ao fim de meses curtos. */
export function addUtcMonths(d: Date, n: number): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + n;
  const target = new Date(Date.UTC(y, m, 1));
  const day = Math.min(
    d.getUTCDate(),
    daysInMonth(target.getUTCFullYear(), target.getUTCMonth()),
  );
  return new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), day));
}

const monthIndex = (d: Date) =>
  d.getUTCFullYear() * MONTHS_PER_YEAR + d.getUTCMonth();

/**
 * Meses de calendario ate ao prazo, arredondado para cima (1 nov a 1 fev =
 * 3; 1 nov a 31 dez = 2). Prazo hoje ou passado = 0; no futuro, minimo 1.
 */
export function monthsUntil(today: Date, deadline: Date): number {
  if (deadline <= today) return 0;
  const whole = monthIndex(deadline) - monthIndex(today);
  const partial = deadline.getUTCDate() > today.getUTCDate() ? 1 : 0;
  return Math.max(1, whole + partial);
}

const byUrgency = (a: GoalInput, b: GoalInput) =>
  (a.deadline?.getTime() ?? 0) - (b.deadline?.getTime() ?? 0) ||
  a.createdAt.getTime() - b.createdAt.getTime();

/**
 * Plano de cada objetivo e do conjunto. A sugestao reparte o excedente:
 * primeiro os prazos mais proximos (ate ao necessario), depois o que sobra
 * em partes iguais pelos objetivos sem prazo (ate ao que lhes falta).
 * Objetivos com o prazo passado ficam fora da reparticao (overdue).
 */
export function planGoals(
  goals: GoalInput[],
  surplus: SurplusEstimate,
  today: Date,
): { goalPlans: GoalPlan[]; goalPlanSummary: GoalPlanSummary } {
  const available = Math.max(0, surplus.monthlyCents);
  const base = goals.map((g) => {
    const remainingCents = Math.max(0, g.targetCents - g.savedCents);
    const monthsLeft = g.deadline ? monthsUntil(today, g.deadline) : null;
    const requiredMonthlyCents =
      monthsLeft === null
        ? null
        : monthsLeft === 0
          ? remainingCents
          : Math.ceil(remainingCents / monthsLeft);
    return { g, remainingCents, monthsLeft, requiredMonthlyCents };
  });
  const active = base.filter((b) => b.remainingCents > 0);
  const withDeadline = active
    .filter((b) => b.monthsLeft !== null && b.monthsLeft > 0)
    .sort((a, b) => byUrgency(a.g, b.g));
  const noDeadline = active.filter((b) => b.monthsLeft === null);

  const suggested = new Map<string, number>();
  let left = available;
  for (const b of withDeadline) {
    const give = Math.min(b.requiredMonthlyCents ?? 0, left);
    suggested.set(b.g.id, give);
    left -= give;
  }
  noDeadline.forEach((b, i) => {
    const share = Math.floor(left / (noDeadline.length - i));
    const give = Math.min(share, b.remainingCents);
    suggested.set(b.g.id, give);
    left -= give;
  });

  const goalPlans = base.map((b): GoalPlan => {
    const suggestedMonthlyCents = suggested.get(b.g.id) ?? 0;
    const planned = b.g.monthlyPlanCents ?? suggestedMonthlyCents;
    const overdue = b.monthsLeft === 0 && b.remainingCents > 0;
    return {
      goalId: b.g.id,
      remainingCents: b.remainingCents,
      monthsLeft: b.monthsLeft,
      requiredMonthlyCents: b.requiredMonthlyCents,
      monthlyPlanCents: b.g.monthlyPlanCents,
      suggestedMonthlyCents,
      plannedMonthlyCents: planned,
      planSource:
        b.g.monthlyPlanCents === null
          ? GOAL_PLAN_SOURCES.SUGGESTED
          : GOAL_PLAN_SOURCES.USER,
      projectedCompletionDate:
        b.remainingCents > 0 && planned > 0
          ? toDateKey(
              addUtcMonths(today, Math.ceil(b.remainingCents / planned)),
            )
          : null,
      overdue,
      status: statusOf(
        b.remainingCents,
        b.requiredMonthlyCents,
        overdue,
        planned,
        available,
      ),
    };
  });

  const totalRequiredMonthlyCents = withDeadline.reduce(
    (a, b) => a + (b.requiredMonthlyCents ?? 0),
    0,
  );
  const totalPlannedMonthlyCents = active.reduce(
    (a, b) => a + (b.g.monthlyPlanCents ?? 0),
    0,
  );
  return {
    goalPlans,
    goalPlanSummary: {
      surplus,
      availableMonthlyCents: available,
      totalRequiredMonthlyCents,
      totalPlannedMonthlyCents,
      allocationRealistic: totalRequiredMonthlyCents <= available,
      planRealistic: totalPlannedMonthlyCents <= available,
      shortfallCents: Math.max(0, totalRequiredMonthlyCents - available),
      suggestedSplit: [...withDeadline, ...noDeadline].map((b) => ({
        goalId: b.g.id,
        suggestedMonthlyCents: suggested.get(b.g.id) ?? 0,
      })),
      overdueGoalIds: goalPlans.filter((p) => p.overdue).map((p) => p.goalId),
    },
  };
}

// Ordem: feito, sem prazo, impossivel (prazo passado ou mais do que todo o
// excedente), em risco (ritmo abaixo do necessario), a caminho.
function statusOf(
  remaining: number,
  required: number | null,
  overdue: boolean,
  planned: number,
  available: number,
): GoalPlanStatus {
  if (remaining === 0) return GOAL_PLAN_STATUSES.DONE;
  if (required === null) return GOAL_PLAN_STATUSES.NO_DEADLINE;
  if (overdue || required > available) return GOAL_PLAN_STATUSES.UNREALISTIC;
  if (planned < required) return GOAL_PLAN_STATUSES.AT_RISK;
  return GOAL_PLAN_STATUSES.ON_TRACK;
}

/** Chaves YYYY-MM dos N meses completos antes do mes de `today`. */
export function historyMonthKeys(today: Date, months: number): string[] {
  const keys: string[] = [];
  const start = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1),
  );
  for (let i = months; i >= 1; i--)
    keys.push(monthKey(addUtcMonths(start, -i)));
  return keys;
}
