export const TAGS_MAX = 10;
export const TAG_LEN_MAX = 24;

/** Trim, lowercase, collapse spaces, drop empties, dedupe, cap count and length. */
export function normalizeTags(input: unknown[]): string[] {
  const seen = new Set<string>();
  for (const raw of input) {
    if (typeof raw !== 'string') continue;
    const tag = raw
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .slice(0, TAG_LEN_MAX)
      .trim();
    if (tag) seen.add(tag);
  }
  return [...seen].slice(0, TAGS_MAX);
}
