import { useEffect, useState } from 'react';
import { DEFAULT_COLUMN_ORDER, TASKS_TABLE_COLUMNS, type TasksTableColumnId } from '../lib/tasksTableColumns';

const STORAGE_KEY = 'pm-tasks-table-column-order';

function loadOrder(): TasksTableColumnId[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_COLUMN_ORDER;
    const parsed = JSON.parse(raw) as string[];
    // Validates against the CURRENT known column set, not just "is this
    // an array" - if a column was ever added/removed/renamed since
    // someone last saved a custom order, a stale saved list could be
    // missing a real column or contain a ghost one. Falling back to
    // default in that case is safer than rendering a table with a
    // column silently missing.
    const validIds = new Set(TASKS_TABLE_COLUMNS.map((c) => c.id));
    const isValid =
      Array.isArray(parsed) &&
      parsed.length === DEFAULT_COLUMN_ORDER.length &&
      parsed.every((id) => validIds.has(id as TasksTableColumnId));
    return isValid ? (parsed as TasksTableColumnId[]) : DEFAULT_COLUMN_ORDER;
  } catch {
    return DEFAULT_COLUMN_ORDER;
  }
}

export function useTasksTableColumnOrder() {
  const [columnOrder, setColumnOrder] = useState<TasksTableColumnId[]>(loadOrder);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(columnOrder));
    } catch {
      // Best-effort only, same as every other localStorage pref in this app.
    }
  }, [columnOrder]);

  // Moves `draggedId` to sit right where `targetId` currently is -
  // everything between the two shifts over by one, nothing else changes.
  const reorderColumns = (draggedId: TasksTableColumnId, targetId: TasksTableColumnId) => {
    if (draggedId === targetId) return;
    setColumnOrder((prev) => {
      const next = prev.filter((id) => id !== draggedId);
      const targetIndex = next.indexOf(targetId);
      next.splice(targetIndex, 0, draggedId);
      return next;
    });
  };

  const resetColumnOrder = () => setColumnOrder(DEFAULT_COLUMN_ORDER);

  return { columnOrder, reorderColumns, resetColumnOrder };
}
