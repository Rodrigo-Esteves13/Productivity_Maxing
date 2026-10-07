import type { Difficulty, ProgressStatus, Task } from '../types/models';
import type { TasksTableColumnId } from '../lib/tasksTableColumns';
import type { SortDirection } from '../lib/sortDirection';

// Ordem "natural" (crescente) de cada enum: menor = mais leve / mais cedo.
const DIFFICULTY_RANK: Record<Difficulty, number> = {
  VERY_EASY: 0,
  EASY: 1,
  MEDIUM: 2,
  HARD: 3,
  VERY_HARD: 4,
};

const PROGRESS_RANK: Record<ProgressStatus, number> = {
  VERY_BEHIND: 0,
  BEHIND: 1,
  ON_TRACK: 2,
  AHEAD: 3,
  COMPLETED: 4,
};

// Chaves que o utilizador pode escolher para ordenar (colunas do dashboard
// e modos da pagina de tasks).
export type TaskSortKey = TasksTableColumnId;

// Colunas sem ordem com sentido (o botao do calendario).
const UNSORTABLE: ReadonlySet<TasksTableColumnId> = new Set<TasksTableColumnId>(['calendar']);

export function isSortableColumn(id: TasksTableColumnId): boolean {
  return !UNSORTABLE.has(id);
}

// Compara dois valores que podem faltar. Valores em falta ficam SEMPRE no
// fim, qualquer que seja a direcao (uma task sem prioridade nunca deve
// aparecer no topo so porque se inverteu a ordem).
function compareNullable(a: number | null, b: number | null, direction: SortDirection): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return direction === 'asc' ? a - b : b - a;
}

function compareText(a: string, b: string, direction: SortDirection): number {
  const result = a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
  return direction === 'asc' ? result : -result;
}

function compareByKey(a: Task, b: Task, key: TaskSortKey, direction: SortDirection): number {
  switch (key) {
    case 'date':
      return compareNullable(new Date(a.date).getTime(), new Date(b.date).getTime(), direction);
    case 'area':
      return compareText(a.area?.name ?? '', b.area?.name ?? '', direction);
    case 'title':
      return compareText(a.title, b.title, direction);
    case 'type':
      return compareText(a.academicType ?? '', b.academicType ?? '', direction);
    case 'difficulty':
      return compareNullable(DIFFICULTY_RANK[a.difficulty], DIFFICULTY_RANK[b.difficulty], direction);
    case 'priority':
      // priorityOrder: menor = mais prioritario (convencao de /task-types).
      // 'asc' = mais prioritaria primeiro.
      return compareNullable(a.priorityOrder, b.priorityOrder, direction);
    case 'status':
      return compareNullable(PROGRESS_RANK[a.progressStatus], PROGRESS_RANK[b.progressStatus], direction);
    case 'grade':
      return compareNullable(a.realGrade ?? null, b.realGrade ?? null, direction);
    case 'calendar':
      return 0;
  }
}

// Ordenacao estavel (Array.prototype.sort e estavel): empates mantem a
// ordem que ja vinha. Nao altera o array recebido.
export function sortTasks(
  tasks: readonly Task[],
  key: TaskSortKey,
  direction: SortDirection,
): Task[] {
  return [...tasks].sort((a, b) => compareByKey(a, b, key, direction));
}
