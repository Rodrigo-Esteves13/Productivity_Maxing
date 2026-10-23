import { useI18n } from '../../i18n/useI18n';
import type { VersionedDocStatus } from '../../hooks/useVersionedDoc';

const STATUS_KEY: Record<VersionedDocStatus, string> = {
  loading: 'common.loading',
  saved: 'collab.status.saved',
  dirty: 'collab.status.dirty',
  saving: 'collab.status.saving',
  conflict: 'collab.status.conflict',
  error: 'collab.status.error',
};

const STATUS_CLASS: Record<VersionedDocStatus, string> = {
  loading: 'text-neutral-500',
  saved: 'text-neutral-500',
  dirty: 'text-neutral-400',
  saving: 'text-neutral-400',
  conflict: 'text-amber-400',
  error: 'text-red-400',
};

// Estado da gravacao automatica de um texto partilhado (Pad, nota da turma).
export default function SaveStatusText({ status }: { status: VersionedDocStatus }) {
  const { t } = useI18n();
  return (
    <span role="status" aria-live="polite" className={`text-xs ${STATUS_CLASS[status]}`}>
      {t(STATUS_KEY[status])}
    </span>
  );
}
