import type { TaskSortMode } from '../../hooks/useTaskSortMode';
import { GripVerticalIcon, CalendarIcon, FlagIcon } from '../UI/Icons';
import SegmentedControl from '../UI/SegmentedControl';
import type { SegmentedOption } from '../UI/SegmentedControl';

interface TaskSortControlProps {
  sortMode: TaskSortMode;
  onChange: (mode: TaskSortMode) => void;
}

const OPTIONS: SegmentedOption<TaskSortMode>[] = [
  { value: 'manual', label: 'Manual', icon: GripVerticalIcon },
  { value: 'date', label: 'Date', icon: CalendarIcon },
  { value: 'priority', label: 'Priority', icon: FlagIcon },
];

// Pinned continua sempre a fixar no topo em qualquer modo (ver Tasks.tsx) -
// isto só decide a ordem do resto. Drag-and-drop só fica ativo em
// "Manual" (ver TaskGrid: draggable = !!onReorder), nos outros dois a
// ordem é sempre derivada de um campo, arrastar não faria sentido.
export default function TaskSortControl({ sortMode, onChange }: TaskSortControlProps) {
  return <SegmentedControl options={OPTIONS} value={sortMode} onChange={onChange} />;
}
