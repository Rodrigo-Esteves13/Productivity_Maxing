import { Link } from 'react-router-dom';
import { EyeIcon } from './Icons';

// Olho: abre a task no detalhe da pagina Tasks (/tasks?open=<id>, ja
// suportado por useTasksPage).
export default function ViewTaskButton({ taskId, title }: { taskId: string; title: string }) {
  return (
    <Link
      to={`/tasks?open=${encodeURIComponent(taskId)}`}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-neutral-700 text-neutral-400 hover:text-violet-300 hover:border-violet-700 transition-colors print-hide"
      aria-label={`Open task ${title}`}
      title="Open task"
    >
      <EyeIcon width={14} height={14} />
    </Link>
  );
}
