import ConfirmDialog from '../UI/ConfirmDialog';
import { useI18n } from '../../i18n/useI18n';
import type { useConfirmAction } from '../../hooks/useConfirmAction';

// Desenha o dialogo de um useConfirmAction quando ha uma acao pendente.
export default function ConfirmActionDialog({ state }: { state: ReturnType<typeof useConfirmAction> }) {
  const { t } = useI18n();
  if (!state.pending) return null;
  return (
    <ConfirmDialog
      title={state.pending.title}
      message={state.pending.message}
      confirmLabel={state.pending.confirmLabel}
      cancelLabel={t('common.cancel')}
      tone={state.pending.tone}
      isBusy={state.isBusy}
      error={state.error}
      onConfirm={() => void state.confirm()}
      onCancel={state.cancel}
    />
  );
}
