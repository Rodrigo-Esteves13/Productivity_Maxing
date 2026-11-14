import type { Difficulty, Task } from '../types/models';

// Sugestao de dificuldade com base nas tasks ja concluidas da mesma cadeira
// e do mesmo tipo. Puro e sem rede; so sugere quando ha amostra suficiente.
export const MIN_SIMILAR_TASKS = 3;

export interface DifficultySuggestion {
  difficulty: Difficulty;
  basedOn: number;
}

export function suggestDifficulty(
  tasks: readonly Task[],
  match: { areaId: string; type: string },
  allowed: readonly string[],
): DifficultySuggestion | null {
  if (!match.areaId || !match.type) return null;
  const counts = new Map<Difficulty, number>();
  let total = 0;
  for (const task of tasks) {
    if (task.progressStatus !== 'COMPLETED') continue;
    if (task.areaId !== match.areaId || task.type !== match.type) continue;
    if (!task.difficulty || !allowed.includes(task.difficulty)) continue;
    counts.set(task.difficulty, (counts.get(task.difficulty) ?? 0) + 1);
    total += 1;
  }
  if (total < MIN_SIMILAR_TASKS) return null;
  // Mais frequente; empate resolve-se pela ordem do catalogo (primeira).
  let best: Difficulty | null = null;
  for (const key of allowed) {
    const count = counts.get(key as Difficulty) ?? 0;
    if (count > 0 && (best === null || count > (counts.get(best) ?? 0))) best = key as Difficulty;
  }
  return best ? { difficulty: best, basedOn: total } : null;
}
