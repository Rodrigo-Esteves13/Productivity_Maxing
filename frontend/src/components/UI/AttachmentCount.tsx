import { PaperclipIcon } from './Icons';
import { useI18n } from '../../i18n/useI18n';

// Clipe com o numero de ficheiros da task; silencioso sem anexos.
export default function AttachmentCount({
  count,
  className = '',
}: {
  count?: number;
  className?: string;
}) {
  const { t } = useI18n();
  if (!count || count <= 0) return null;
  const label = t('fileIndicator.label', { count });
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] tabular-nums text-neutral-400 ${className}`}
      title={label}
      aria-label={label}
    >
      <PaperclipIcon className="h-3 w-3" aria-hidden="true" />
      {count}
    </span>
  );
}
