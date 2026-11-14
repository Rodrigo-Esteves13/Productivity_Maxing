import type { Task } from '../types/models';

// Equilibrio entre tipos de task (academico, habitos, projetos...): quanto do
// que fizeste ou tinhas para fazer nos ultimos dias vai para cada tipo.
// Puro e sem rede.
export const BALANCE_WINDOW_DAYS = 30;
export const MIN_BALANCE_TASKS = 6;
// So se listam os tipos com pelo menos esta fatia; o resto some-se em "outros".
const PERCENT = 100;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface BalanceShare {
  type: string;
  count: number;
  percent: number;
}

export interface TypeBalance {
  total: number;
  shares: BalanceShare[];
}

/** Tasks com prazo (ou concluidas) na janela; arquivadas e sem tipo ficam de fora. */
export function computeTypeBalance(tasks: readonly Task[], now: Date = new Date()): TypeBalance | null {
  const from = now.getTime() - BALANCE_WINDOW_DAYS * MS_PER_DAY;
  const counts = new Map<string, number>();
  let total = 0;
  for (const task of tasks) {
    if (!task.type) continue;
    const reference = task.completedAt ?? task.date;
    const at = new Date(reference).getTime();
    if (Number.isNaN(at) || at < from || at > now.getTime() + BALANCE_WINDOW_DAYS * MS_PER_DAY) continue;
    counts.set(task.type, (counts.get(task.type) ?? 0) + 1);
    total += 1;
  }
  if (total < MIN_BALANCE_TASKS) return null;
  const shares = [...counts.entries()]
    .map(([type, count]) => ({ type, count, percent: Math.round((count / total) * PERCENT) }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
  return { total, shares };
}
