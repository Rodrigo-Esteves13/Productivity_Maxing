import { Link } from 'react-router-dom';
import { EyeIcon } from './Icons';
import { useI18n } from '../../i18n/useI18n';

// Olho: abre a task no detalhe da pagina Tasks (/tasks?open=<id>, ja
// suportado por useTasksPage).
export default function ViewTaskButton({ taskId, title }: { taskId: string; title: string }) {
  const { t } = useI18n();
  return (
    <Link
      to={`/tasks?open=${encodeURIComponent(taskId)}`}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-neutral-700 text-neutral-400 hover:text-violet-300 hover:border-violet-700 transition-colors print-hide"
      aria-label={t('common.openTaskNamed', { title })}
      title={t('common.openTask')}
    >
      <EyeIcon width={14} height={14} />
    </Link>
  );
}
