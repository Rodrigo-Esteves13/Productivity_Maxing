import ConfirmDialog from '../UI/ConfirmDialog';

interface DeleteEntryModalProps {
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

// Reutiliza o ConfirmDialog (Esc, foco, aria, bloqueio enquanto apaga).
export default function DeleteEntryModal({ isDeleting, onCancel, onConfirm }: DeleteEntryModalProps) {
  return (
    <ConfirmDialog
      title="Delete this entry?"
      message="This removes the entry's notes, drawing, tables and photos for good. This can't be undone."
      confirmLabel={isDeleting ? 'Deleting...' : 'Delete entry'}
      cancelLabel="Cancel"
      tone="danger"
      isBusy={isDeleting}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
