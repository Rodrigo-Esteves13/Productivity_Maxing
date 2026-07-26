import { useState } from 'react';
import { CheckIcon, TrashIcon } from '../UI/Icons';

interface BulkActionsBarProps {
  selectedCount: number;
  onMarkDone: () => Promise<void>;
  onDelete: () => Promise<void>;
  onClear: () => void;
}

// Shows up in place of nothing whenever at least one task is checked in
// TasksTable (desktop rows or mobile cards). Kept to the two actions
// that are actually useful in bulk - marking several tasks done at once
// and deleting several at once - rather than trying to bulk-edit every
// field, which would need its own modal and isn't a real use case.
export default function BulkActionsBar({
  selectedCount,
  onMarkDone,
  onDelete,
  onClear,
}: BulkActionsBarProps) {
  const [isMarkingDone, setIsMarkingDone] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (selectedCount === 0) return null;

  const handleMarkDone = async () => {
    setIsMarkingDone(true);
    try {
      await onMarkDone();
    } finally {
      setIsMarkingDone(false);
    }
  };

  const handleDelete = async () => {
    if (
      !window.confirm(
        `Delete ${selectedCount} selected task${selectedCount === 1 ? '' : 's'}? This can't be undone.`,
      )
    ) {
      return;
    }
    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="print-hide flex flex-wrap items-center justify-between gap-3 rounded-lg border border-violet-800/50 bg-violet-900/20 px-4 py-3 mb-4">
      <p className="text-sm text-neutral-200">
        <span className="font-semibold text-white">{selectedCount}</span> selected
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleMarkDone}
          disabled={isMarkingDone || isDeleting}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-md transition-colors disabled:opacity-50"
        >
          <CheckIcon />
          {isMarkingDone ? 'Marking...' : 'Mark as done'}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isMarkingDone || isDeleting}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-red-700 hover:bg-red-600 rounded-md transition-colors disabled:opacity-50"
        >
          <TrashIcon />
          {isDeleting ? 'Deleting...' : 'Delete'}
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={isMarkingDone || isDeleting}
          className="px-3 py-1.5 text-sm text-neutral-400 hover:text-neutral-200 disabled:opacity-50"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
