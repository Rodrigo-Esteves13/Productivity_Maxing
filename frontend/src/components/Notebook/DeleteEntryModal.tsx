interface DeleteEntryModalProps {
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

// Mesmo padrão visual do DisconnectCalendarModal/DeleteAccountModal em
// Profile - sem confirmação por texto (isto é uma entrada de caderno,
// não a conta toda), só o Cancel/Delete normal.
export default function DeleteEntryModal({ isDeleting, onCancel, onConfirm }: DeleteEntryModalProps) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <div className="bg-neutral-900 border border-red-900/40 rounded-xl p-6 max-w-md w-full">
        <h3 className="text-lg font-bold text-white mb-2">Delete this entry?</h3>
        <p className="text-neutral-400 text-sm mb-4">
          This removes the entry's notes, drawing, tables and photos for good. This can't be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-neutral-300 hover:bg-neutral-800 text-sm"
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 rounded-lg bg-red-700 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-600 transition-colors"
          >
            {isDeleting ? 'Deleting...' : 'Delete entry'}
          </button>
        </div>
      </div>
    </div>
  );
}
