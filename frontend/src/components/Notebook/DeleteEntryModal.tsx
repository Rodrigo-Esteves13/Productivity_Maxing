import ConfirmDialog from '../UI/ConfirmDialog';
import { useI18n } from '../../i18n/useI18n';

interface DeleteEntryModalProps {
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

// Reutiliza o ConfirmDialog (Esc, foco, aria, bloqueio enquanto apaga).
export default function DeleteEntryModal({ isDeleting, onCancel, onConfirm }: DeleteEntryModalProps) {
  const { t } = useI18n();
  return (
    <ConfirmDialog
      title={t('ui.deleteThisEntry')}
      message={t('ui.thisRemovesTheEntryS')}
      confirmLabel={isDeleting ? t('ui.deleting') : t('notebook.delete')}
      cancelLabel={t('ui.cancel')}
      tone="danger"
      isBusy={isDeleting}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
