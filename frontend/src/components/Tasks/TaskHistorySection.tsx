import { useCallback, useState } from 'react';
import api from '../../api/client';
import LinesSkeleton from '../UI/LinesSkeleton';
import { useLoadOnce } from '../../hooks/useLoadOnce';
import { useEnumLabel } from '../../hooks/useEnumLabel';
import { useI18n } from '../../i18n/useI18n';
import { formatChangeValue, isOpaqueField, type TaskChange } from '../../lib/taskHistory';

interface TaskHistorySectionProps {
  taskId: string;
}

function HistoryList({ taskId }: TaskHistorySectionProps) {
  const { t } = useI18n();
  const enumLabel = useEnumLabel();
  const fetcher = useCallback(
    async () => (await api.get<TaskChange[]>(`/tasks/${encodeURIComponent(taskId)}/changes`)).data,
    [taskId],
  );
  const { data, isLoading, error } = useLoadOnce(fetcher);

  if (isLoading) return <LinesSkeleton lines={3} />;
  if (error) return <p className="text-sm text-neutral-400">{t('taskHistory.error')}</p>;
  if (!data || data.length === 0) return <p className="text-sm text-neutral-400">{t('taskHistory.none')}</p>;

  const deps = {
    t,
    enumLabel,
    formatDate: (iso: string) => new Date(iso).toLocaleDateString(),
  };
  return (
    <ul className="space-y-1.5">
      {data.map((change) => (
        <li key={change.id} className="text-sm text-neutral-300">
          <span className="text-neutral-500 tabular-nums">{new Date(change.createdAt).toLocaleString()}</span>{' '}
          <span className="font-medium text-white">{t(`taskHistory.field.${change.field}`)}</span>
          {isOpaqueField(change.field)
            ? ''
            : `: ${formatChangeValue(change.field, change.fromValue, deps)} ${t('taskHistory.to')} ${formatChangeValue(change.field, change.toValue, deps)}`}
        </li>
      ))}
    </ul>
  );
}

// Historico de alteracoes da task, so carregado quando o user o abre.
export default function TaskHistorySection({ taskId }: TaskHistorySectionProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className="text-sm text-violet-400 hover:text-violet-300"
      >
        {t(isOpen ? 'taskHistory.hide' : 'taskHistory.show')}
      </button>
      {isOpen && (
        <div className="mt-2">
          <HistoryList taskId={taskId} />
        </div>
      )}
    </div>
  );
}
