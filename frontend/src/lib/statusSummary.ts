import type { Area, Task } from '../types/models';
import { computeTargetVsReal } from '../utils/targetVsReal';
import { getDateStatus } from '../utils/taskDateStatus';
import { hasFirmDate } from './taskReadiness';
import { daysUntil } from './areaList';

// Janela (dias) em que um prazo ainda conta como "proximo" no resumo.
export const STATUS_SUMMARY_DEADLINE_WINDOW_DAYS = 7;
// Maximo de frases mostradas; as de menor prioridade caem primeiro.
export const STATUS_SUMMARY_MAX_CLAUSES = 3;

export interface StatusSummaryAreaFact {
  name: string;
  average: number;
  target: number;
}

export interface StatusSummaryDeadlineFact {
  title: string;
  daysLeft: number;
}

export interface StatusSummaryFacts {
  bestArea: StatusSummaryAreaFact | null;
  worstArea: StatusSummaryAreaFact | null;
  overdueCount: number;
  nextDeadline: StatusSummaryDeadlineFact | null;
}

export type StatusSummaryClauseKey = 'behind' | 'overdue' | 'next' | 'best';

// Ordem = prioridade: o que pede atencao vem primeiro.
export const STATUS_SUMMARY_CLAUSE_ORDER: readonly StatusSummaryClauseKey[] = [
  'behind',
  'overdue',
  'next',
  'best',
];

// Funcao pura sobre dados que o Dashboard ja carregou (sem pedidos novos).
//  - melhor cadeira: maior folga (media real - alvo) >= 0;
//  - pior cadeira: menor folga < 0;
//  - proximo prazo: task aberta, data firme, nao atrasada, dentro da janela.
export function computeStatusSummaryFacts(
  tasks: readonly Task[],
  areas: readonly Area[],
  now: Date = new Date(),
): StatusSummaryFacts {
  // computeTargetVsReal devolve por ordem crescente de folga.
  const gaps = computeTargetVsReal([...tasks], [...areas]);
  const toFact = (row: (typeof gaps)[number]): StatusSummaryAreaFact => ({
    name: row.area.name,
    average: row.avgReal,
    target: row.avgTarget,
  });
  const worst = gaps.length > 0 && gaps[0].gap < 0 ? gaps[0] : null;
  const last = gaps.length > 0 ? gaps[gaps.length - 1] : null;
  const best = last && last.gap >= 0 ? last : null;

  let overdueCount = 0;
  let nextDeadline: StatusSummaryDeadlineFact | null = null;
  for (const task of tasks) {
    if (task.progressStatus === 'COMPLETED') continue;
    if (getDateStatus(task, now) === 'overdue') {
      overdueCount += 1;
      continue;
    }
    if (!hasFirmDate(task)) continue;
    const daysLeft = daysUntil(task.date, now);
    if (daysLeft < 0 || daysLeft > STATUS_SUMMARY_DEADLINE_WINDOW_DAYS) continue;
    if (!nextDeadline || daysLeft < nextDeadline.daysLeft) {
      nextDeadline = { title: task.title, daysLeft };
    }
  }

  return {
    bestArea: best ? toFact(best) : null,
    worstArea: worst ? toFact(worst) : null,
    overdueCount,
    nextDeadline,
  };
}

// Clausulas com dados, por prioridade e limitadas ao maximo.
export function pickStatusSummaryClauses(facts: StatusSummaryFacts): StatusSummaryClauseKey[] {
  const present: Record<StatusSummaryClauseKey, boolean> = {
    behind: facts.worstArea !== null,
    overdue: facts.overdueCount > 0,
    next: facts.nextDeadline !== null,
    best: facts.bestArea !== null,
  };
  return STATUS_SUMMARY_CLAUSE_ORDER.filter((key) => present[key]).slice(
    0,
    STATUS_SUMMARY_MAX_CLAUSES,
  );
}
