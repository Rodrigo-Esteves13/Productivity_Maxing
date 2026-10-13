import ConfirmDialog from '../UI/ConfirmDialog';

interface DisconnectCalendarModalProps {
  isDisconnecting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

// Reutiliza o ConfirmDialog (Esc, foco, aria, bloqueio enquanto corre).
export default function DisconnectCalendarModal({
  isDisconnecting,
  error,
  onCancel,
  onConfirm,
}: DisconnectCalendarModalProps) {
  return (
    <ConfirmDialog
      title="Disconnect Google Calendar?"
      message="Events already added to your Google Calendar will stay there - they just won't stay in sync anymore. The app's access is revoked with Google. You can reconnect anytime from here."
      confirmLabel={isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
      cancelLabel="Cancel"
      tone="danger"
      isBusy={isDisconnecting}
      error={error}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
