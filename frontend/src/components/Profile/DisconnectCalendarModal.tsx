interface DisconnectCalendarModalProps {
  isDisconnecting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function DisconnectCalendarModal({
  isDisconnecting,
  error,
  onCancel,
  onConfirm,
}: DisconnectCalendarModalProps) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 max-w-md w-full">
        <h3 className="text-lg font-bold text-white mb-2">Disconnect Google Calendar?</h3>
        <p className="text-neutral-400 text-sm mb-4">
          Tasks already synced will keep their events on your Google Calendar - they just
          won't stay in sync anymore. You can reconnect anytime from here.
        </p>
        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-neutral-300 hover:bg-neutral-800 text-sm"
            disabled={isDisconnecting}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDisconnecting}
            className="px-4 py-2 rounded-lg bg-red-700 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-600 transition-colors"
          >
            {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
          </button>
        </div>
      </div>
    </div>
  );
}
