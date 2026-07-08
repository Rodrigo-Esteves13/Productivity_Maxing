// Turns a SCREAMING_SNAKE_CASE enum value (as stored in the DB) into a
// human-friendly label, e.g. "VERY_EASY" -> "Very Easy".
// Since the enums are now stored in English, this is all that's needed,
// no per-value translation dictionary required.
export function formatEnumLabel(value: string | null | undefined): string {
  if (!value) return '—';
  return value
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
