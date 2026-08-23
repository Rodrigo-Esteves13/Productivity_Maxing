interface PriorityBadgeProps {
  label: string;
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
export default function PriorityBadge({ label, colorHex }: PriorityBadgeProps) {
  const color = colorHex || FALLBACK_COLOR;

  return (
    <span
      className="px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase rounded-md border"
      style={{
        backgroundColor: `${color}1a`, // ~10% opacity
        borderColor: `${color}4d`, // ~30% opacity
        color,
      }}
    >
      {label}
    </span>
  );
}
