// Checkbox column is deliberately not in here - it's pinned first,
// always, and isn't meaningful to reorder (selection should always be
// the leftmost, predictable target, not something that moves around).
export const TASKS_TABLE_COLUMNS = [
  { id: 'date', labelKey: 'tasks.col.date' },
  { id: 'area', labelKey: 'tasks.col.area' },
  { id: 'title', labelKey: 'tasks.col.title' },
  { id: 'type', labelKey: 'tasks.col.type' },
  { id: 'difficulty', labelKey: 'tasks.col.difficulty' },
  { id: 'priority', labelKey: 'tasks.col.priority' },
  { id: 'status', labelKey: 'tasks.col.status' },
  { id: 'grade', labelKey: 'tasks.col.grade' },
  { id: 'calendar', labelKey: 'tasks.col.calendar' },
] as const;

export type TasksTableColumnId = (typeof TASKS_TABLE_COLUMNS)[number]['id'];

export const DEFAULT_COLUMN_ORDER: TasksTableColumnId[] = TASKS_TABLE_COLUMNS.map((c) => c.id);
