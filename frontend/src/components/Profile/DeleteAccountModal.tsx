interface DeleteAccountModalProps {
  confirmText: string;
  isDeleting: boolean;
  isConfirmEnabled: boolean;
  error: string | null;
  onConfirmTextChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function DeleteAccountModal({
  confirmText,
  isDeleting,
  isConfirmEnabled,
  error,
  onConfirmTextChange,
  onCancel,
  onConfirm,
}: DeleteAccountModalProps) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <div className="bg-neutral-900 border border-red-900/40 rounded-xl p-6 max-w-md w-full">
        <h3 className="text-lg font-bold text-white mb-2">Delete your account?</h3>
        <p className="text-neutral-400 text-sm mb-4">
          This is permanent. Type <span className="font-mono text-red-400">DELETE</span> below
          to confirm.
        </p>
        <input
          type="text"
          value={confirmText}
          onChange={(e) => onConfirmTextChange(e.target.value)}
          placeholder="DELETE"
          className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white mb-3 focus:outline-none focus:border-red-700"
        />
        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
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
            disabled={!isConfirmEnabled || isDeleting}
            className="px-4 py-2 rounded-lg bg-red-700 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-600 transition-colors"
          >
            {isDeleting ? 'Deleting...' : 'Delete permanently'}
          </button>
        </div>
      </div>
    </div>
  );
}
