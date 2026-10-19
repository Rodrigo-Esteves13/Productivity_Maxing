import { useState } from 'react';
import { CheckIcon, TrashIcon } from '../UI/Icons';
import { useFeedback } from '../../context/useFeedback';
import { useI18n } from '../../i18n/useI18n';
import { fillNodes } from '../../i18n/fillNodes';

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
  const { t } = useI18n();
  const { confirm } = useFeedback();
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
    const confirmed = await confirm({
      title: t('ui.deleteTasks'),
      message: t(selectedCount === 1 ? 'ui.deleteSelectedTasksOne' : 'ui.deleteSelectedTasksMany', { count: selectedCount }),
      confirmLabel: t('common.delete'),
      tone: 'danger',
    });
    if (!confirmed) return;
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
        {fillNodes(t('ui.selectedCount'), {
          count: <span className="font-semibold text-white">{selectedCount}</span>,
        })}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleMarkDone}
          disabled={isMarkingDone || isDeleting}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-md transition-colors disabled:opacity-50"
        >
          <CheckIcon />
          {isMarkingDone ? t('ui.marking') : t('ui.markAsDone')}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isMarkingDone || isDeleting}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-red-700 hover:bg-red-600 rounded-md transition-colors disabled:opacity-50"
        >
          <TrashIcon />
          {isDeleting ? t('ui.deleting') : t('common.delete')}
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={isMarkingDone || isDeleting}
          className="px-3 py-1.5 text-sm text-neutral-400 hover:text-neutral-200 disabled:opacity-50"
        >
          {t('ui.clear')}
        </button>
      </div>
    </div>
  );
}
