import type { Task } from '../types/models';

// Sugere a cadeira (Area) de uma task nova pelo titulo: 1) o nome da cadeira
// aparece no titulo; 2) tasks anteriores comecam pela mesma palavra e quase
// todas estao na mesma cadeira. Puro e sem rede.
export const MIN_AREA_NAME_LENGTH = 4;
export const MIN_MATCHING_TASKS = 2;
// Minimo de caracteres da primeira palavra para contar como padrao
// (evita "a", "de", "of").
export const MIN_LEADING_WORD_LENGTH = 4;

export interface AreaCandidate {
  id: string;
  name: string;
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function leadingWord(title: string): string {
  return normalize(title).split(/[^a-z0-9]+/)[0] ?? '';
}

export function suggestAreaId(
  title: string,
  areas: readonly AreaCandidate[],
  tasks: readonly Pick<Task, 'title' | 'areaId'>[],
): string | null {
  const normalizedTitle = normalize(title);
  if (normalizedTitle.length < MIN_LEADING_WORD_LENGTH) return null;

  const byName = areas.find((area) => {
    const name = normalize(area.name);
    return name.length >= MIN_AREA_NAME_LENGTH && normalizedTitle.includes(name);
  });
  if (byName) return byName.id;

  const word = leadingWord(title);
  if (word.length < MIN_LEADING_WORD_LENGTH) return null;
  const counts = new Map<string, number>();
  let total = 0;
  for (const task of tasks) {
    if (leadingWord(task.title) !== word) continue;
    counts.set(task.areaId, (counts.get(task.areaId) ?? 0) + 1);
    total += 1;
  }
  if (total < MIN_MATCHING_TASKS) return null;
  const [topId, topCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  // Todas (ou quase) na mesma cadeira: senao nao se adivinha.
  return topCount === total && areas.some((a) => a.id === topId) ? topId : null;
}
