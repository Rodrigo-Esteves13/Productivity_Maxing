import type { TaskSortMode } from '../../hooks/useTaskSortMode';
import { GripVerticalIcon, CalendarIcon, FlagIcon } from '../UI/Icons';

interface TaskSortControlProps {
  sortMode: TaskSortMode;
  onChange: (mode: TaskSortMode) => void;
}

const OPTIONS: { mode: TaskSortMode; label: string; icon: typeof GripVerticalIcon }[] = [
  { mode: 'manual', label: 'Manual', icon: GripVerticalIcon },
  { mode: 'date', label: 'Date', icon: CalendarIcon },
  { mode: 'priority', label: 'Priority', icon: FlagIcon },
];

// Pinned continua sempre a fixar no topo em qualquer modo (ver Tasks.tsx) -
// isto só decide a ordem do resto. Drag-and-drop só fica ativo em
// "Manual" (ver TaskGrid: draggable = !!onReorder), nos outros dois a
// ordem é sempre derivada de um campo, arrastar não faria sentido.
export default function TaskSortControl({ sortMode, onChange }: TaskSortControlProps) {
  return (
    <div className="flex items-center rounded-md border border-neutral-800 bg-neutral-900 p-0.5">
      {OPTIONS.map(({ mode, label, icon: Icon }) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          aria-pressed={sortMode === mode}
          className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${
            sortMode === mode
              ? 'bg-violet-600 text-white'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}
