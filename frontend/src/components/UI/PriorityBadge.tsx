import { usePriorityLabel } from '../../hooks/usePriorityLabel';

interface PriorityBadgeProps {
  priorityKey: string;
  // Rotulo do catalogo (priorityLabel da task); ver usePriorityLabel.
  label: string | null;
  colorHex?: string | null;
}

const FALLBACK_COLOR = '#808080';

// Same technique as any other colorHex-driven UI in this app - but unlike
// AreaCard/TaskTypesTable (which just show a ColorDot next to plain
// text), this needs a full colored pill like DifficultyBadge/StatusBadge
// had with their hardcoded per-key Record. Hardcoding was fine when the
// key set was a fixed 3-value enum; now that admins can rename/add/reorder
// priorities from /task-types (Priorities section), the badge has to
// derive its look from whatever colorHex the admin picked, not from a
// Record keyed by values that might not even exist anymore.
// Appending 2 hex digits for alpha to a 6-digit hex color is a standard
// lightweight tint trick - no color-math library needed for "same hue,
// low-opacity background".
// whitespace-nowrap: em colunas estreitas (ex: tabela em chines) o rotulo
// partia-se a meio ("Mediu" / "m") e a pilula ficava em duas linhas.
export default function PriorityBadge({ priorityKey, label, colorHex }: PriorityBadgeProps) {
  const priorityLabel = usePriorityLabel();
  const color = colorHex || FALLBACK_COLOR;

  return (
    <span
      className="inline-block whitespace-nowrap px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase rounded-md border"
      style={{
        backgroundColor: `${color}1a`, // ~10% opacity
        borderColor: `${color}4d`, // ~30% opacity
        color,
      }}
    >
      {priorityLabel(priorityKey, label)}
    </span>
  );
}
