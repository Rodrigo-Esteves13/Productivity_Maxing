import { GraduationCapIcon } from '../UI/Icons';
import { MONTH_CHIP_TONE_CLASSES, type MonthChip } from '../../lib/monthAgenda';
import { useMonthChipLabel } from '../../hooks/useMonthChipLabel';

// Chip compacto de uma linha na celula do mes (ecras sm+). A hora fica no
// title: em ~90px de largura so cabe o nome.
export default function MonthChipPill({ chip }: { chip: MonthChip }) {
  const chipLabel = useMonthChipLabel();
  const label = chipLabel(chip);
  return (
    <span
      title={chip.time ? `${chip.time} ${label}` : label}
      className={`flex items-center gap-1 min-w-0 rounded px-1.5 py-0.5 text-[11px] leading-tight ${
        MONTH_CHIP_TONE_CLASSES[chip.tone].chip
      } ${chip.done ? 'line-through opacity-60' : ''}`}
    >
      {chip.tone === 'exam' && <GraduationCapIcon aria-hidden className="h-3 w-3 shrink-0" />}
      <span className="truncate">{label}</span>
    </span>
  );
}
