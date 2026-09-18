// Checkbox column is deliberately not in here - it's pinned first,
// always, and isn't meaningful to reorder (selection should always be
// the leftmost, predictable target, not something that moves around).
export const TASKS_TABLE_COLUMNS = [
  { id: 'date', label: 'Date / Due' },
  { id: 'area', label: 'Area' },
  { id: 'title', label: 'Title / Topics' },
  { id: 'type', label: 'Type / Weight' },
  { id: 'difficulty', label: 'Difficulty' },
  { id: 'status', label: 'Status' },
  { id: 'grade', label: 'Target / Real' },
  { id: 'calendar', label: 'Calendar' },
] as const;

export type TasksTableColumnId = (typeof TASKS_TABLE_COLUMNS)[number]['id'];

export const DEFAULT_COLUMN_ORDER: TasksTableColumnId[] = TASKS_TABLE_COLUMNS.map((c) => c.id);
