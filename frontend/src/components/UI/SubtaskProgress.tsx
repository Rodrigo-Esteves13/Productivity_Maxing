import type { Subtask } from '../../types/models';

// Mini contador "2/5" da checklist; nao mostra nada sem subtasks.
export default function SubtaskProgress({
  subtasks,
  className = '',
}: {
  subtasks?: Subtask[];
  className?: string;
}) {
  if (!subtasks || subtasks.length === 0) return null;
  const done = subtasks.filter((s) => s.isDone).length;
  const complete = done === subtasks.length;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] tabular-nums ${
        complete ? 'text-violet-300' : 'text-neutral-400'
      } ${className}`}
      title={`${done} of ${subtasks.length} steps done`}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
      {done}/{subtasks.length}
    </span>
  );
}
