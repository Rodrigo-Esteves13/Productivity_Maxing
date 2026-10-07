import type { TaskSortMode } from '../../hooks/useTaskSortMode';
import { GripVerticalIcon, CalendarIcon, FlagIcon } from '../UI/Icons';
import SegmentedControl from '../UI/SegmentedControl';
import SortDirectionButton from '../UI/SortDirectionButton';
import type { SortDirection } from '../../lib/sortDirection';
import type { SegmentedOption } from '../UI/SegmentedControl';

interface TaskSortControlProps {
  sortMode: TaskSortMode;
  onChange: (mode: TaskSortMode) => void;
  direction: SortDirection;
  onToggleDirection: () => void;
}

// Texto do botao de direcao para cada modo. 'manual' nao usa direcao.
const DIRECTION_LABELS: Record<Exclude<TaskSortMode, 'manual'>, { asc: string; desc: string }> = {
  date: { asc: 'Nearest first', desc: 'Furthest first' },
  priority: { asc: 'Highest first', desc: 'Lowest first' },
};

const OPTIONS: SegmentedOption<TaskSortMode>[] = [
  { value: 'manual', label: 'Manual', icon: GripVerticalIcon },
  { value: 'date', label: 'Date', icon: CalendarIcon },
  { value: 'priority', label: 'Priority', icon: FlagIcon },
];

// Pinned continua sempre a fixar no topo em qualquer modo (ver Tasks.tsx) -
// isto só decide a ordem do resto. Drag-and-drop só fica ativo em
// "Manual" (ver TaskGrid: draggable = !!onReorder), nos outros dois a
// ordem é sempre derivada de um campo, arrastar não faria sentido.
export default function TaskSortControl({ sortMode, onChange, direction, onToggleDirection }: TaskSortControlProps) {
  return (
    <div className="flex items-center gap-2">
      <SegmentedControl options={OPTIONS} value={sortMode} onChange={onChange} />
      {sortMode !== 'manual' && (
        <SortDirectionButton
          direction={direction}
          onToggle={onToggleDirection}
          ascLabel={DIRECTION_LABELS[sortMode].asc}
          descLabel={DIRECTION_LABELS[sortMode].desc}
        />
      )}
    </div>
  );
}
