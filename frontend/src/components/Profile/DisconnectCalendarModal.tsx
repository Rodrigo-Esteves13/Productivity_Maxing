import ConfirmDialog from '../UI/ConfirmDialog';
import { useI18n } from '../../i18n/useI18n';

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
  const { t } = useI18n();
  return (
    <ConfirmDialog
      title={t('ui.disconnectGoogleCalendar')}
      message={t('ui.eventsAlreadyAddedToYour')}
      confirmLabel={isDisconnecting ? t('ui.disconnecting') : t('ui.disconnect')}
      cancelLabel={t('ui.cancel')}
      tone="danger"
      isBusy={isDisconnecting}
      error={error}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
