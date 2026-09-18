import { useState, type DragEvent } from 'react';
import { TASKS_TABLE_COLUMNS, type TasksTableColumnId } from '../../lib/tasksTableColumns';

interface TasksTableHeaderProps {
  allSelected?: boolean;
  onToggleAll?: () => void;
  columnOrder: TasksTableColumnId[];
  onReorder: (draggedId: TasksTableColumnId, targetId: TasksTableColumnId) => void;
}

const COLUMN_LABEL: Record<TasksTableColumnId, string> = Object.fromEntries(
  TASKS_TABLE_COLUMNS.map((c) => [c.id, c.label]),
) as Record<TasksTableColumnId, string>;

// Columns that read better centered than left-aligned - kept as a small
// exception list rather than baking alignment into the column config,
// since it's purely a display detail, not something a column "is".
const CENTERED_COLUMNS = new Set<TasksTableColumnId>(['status', 'grade', 'calendar']);

export default function TasksTableHeader({
  allSelected,
  onToggleAll,
  columnOrder,
  onReorder,
}: TasksTableHeaderProps) {
  const [draggedId, setDraggedId] = useState<TasksTableColumnId | null>(null);
  const [dragOverId, setDragOverId] = useState<TasksTableColumnId | null>(null);

  const handleDragStart = (id: TasksTableColumnId) => (e: DragEvent<HTMLTableCellElement>) => {
    setDraggedId(id);
    // Firefox requires setData to actually start a drag - the value
    // itself is never read back, onDrop reads from component state
    // (draggedId) instead, which survives even if a browser doesn't
    // round-trip dataTransfer perfectly.
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (id: TasksTableColumnId) => (e: DragEvent<HTMLTableCellElement>) => {
    e.preventDefault(); // required for onDrop to fire at all
    if (id !== dragOverId) setDragOverId(id);
  };

  const handleDrop = (targetId: TasksTableColumnId) => (e: DragEvent<HTMLTableCellElement>) => {
    e.preventDefault();
    if (draggedId) onReorder(draggedId, targetId);
    setDraggedId(null);
    setDragOverId(null);
  };

  return (
    <thead className="text-xs text-neutral-400 uppercase bg-neutral-950/50 border-b border-neutral-800">
      <tr>
        {onToggleAll && (
          <th className="px-4 py-3 font-medium print-hide">
            <input
              type="checkbox"
              checked={!!allSelected}
              onChange={onToggleAll}
              className="accent-violet-500"
              aria-label="Select all tasks"
            />
          </th>
        )}
        {columnOrder.map((id) => (
          <th
            key={id}
            draggable
            onDragStart={handleDragStart(id)}
            onDragOver={handleDragOver(id)}
            onDrop={handleDrop(id)}
            onDragEnd={() => {
              setDraggedId(null);
              setDragOverId(null);
            }}
            title="Drag to reorder columns"
            className={`px-4 py-3 font-medium cursor-grab active:cursor-grabbing select-none transition-colors ${
              CENTERED_COLUMNS.has(id) ? 'text-center' : ''
            } ${dragOverId === id && draggedId !== id ? 'bg-violet-500/10 text-violet-300' : ''}`}
          >
            {COLUMN_LABEL[id]}
          </th>
        ))}
      </tr>
    </thead>
  );
}
