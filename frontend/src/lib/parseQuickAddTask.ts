// src/lib/parseQuickAddTask.ts

// Lightweight PT/EN date-phrase recognizer for CommandPalette's quick-add
// flow. Deliberately NOT a general NLP parser (no dependency, no AI call):
// just the handful of phrasings someone actually types while rushing
// through Cmd+K - "amanha", a weekday name, "sexta as 18h", "12/06".
// Anything it doesn't recognize stays in the title and the date defaults
// to today; it never silently drops text.

const WEEKDAYS: Record<string, number> = {
  domingo: 0,
  sunday: 0,
  segunda: 1,
  'segunda-feira': 1,
  monday: 1,
  terca: 2,
  terça: 2,
  'terca-feira': 2,
  'terça-feira': 2,
  tuesday: 2,
  quarta: 3,
  'quarta-feira': 3,
  wednesday: 3,
  quinta: 4,
  'quinta-feira': 4,
  thursday: 4,
  sexta: 5,
  'sexta-feira': 5,
  friday: 5,
  sabado: 6,
  sábado: 6,
  saturday: 6,
};

// Longest names first, so "segunda-feira" is matched before "segunda".
const WEEKDAY_NAMES_LONGEST_FIRST = Object.keys(WEEKDAYS).sort((a, b) => b.length - a.length);

export interface QuickAddParseResult {
  title: string;
  date: string; // "YYYY-MM-DD", local calendar day
  time: string | null; // "HH:MM" (24h) or null when no time was typed
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// Always the NEXT occurrence, never today: typing "sexta" on a Friday
// means next Friday, "today" already has its own keyword.
function nextWeekday(from: Date, targetDay: number): Date {
  const result = new Date(from);
  const diff = (targetDay - result.getDay() + 7) % 7 || 7;
  result.setDate(result.getDate() + diff);
  return result;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function parseQuickAddTask(raw: string, now: Date = new Date()): QuickAddParseResult {
  let text = raw.trim();
  let dateKey = toDateKey(now);
  let time: string | null = null;

  // Time first, so "18" in "as 18h" is never mistaken for a day of month.
  // Delimiters are (^|\s) / (?=\s|$) instead of \b throughout this file:
  // \b only understands ASCII word characters, so it never matches next to
  // accented letters ("amanhã", "às") and silently skipped those phrases.
  const timeMatch =
    text.match(/(?:^|\s)[aà]s?\s+(\d{1,2})(?:h|:)(\d{2})?(?=\s|$)/i) ??
    text.match(/(?:^|\s)(\d{1,2}):(\d{2})(?=\s|$)/);
  if (timeMatch) {
    const hours = Math.min(23, parseInt(timeMatch[1], 10));
    const minutes = Math.min(59, parseInt(timeMatch[2] ?? '0', 10) || 0);
    time = `${pad2(hours)}:${pad2(minutes)}`;
    text = text.replace(timeMatch[0], ' ');
  }

  const TODAY_RE = /(?:^|\s)(?:hoje|today)(?=\s|$)/i;
  const TOMORROW_RE = /(?:^|\s)(?:amanh[ãa]|tomorrow)(?=\s|$)/i;

  if (TODAY_RE.test(text)) {
    text = text.replace(TODAY_RE, ' ');
  } else if (TOMORROW_RE.test(text)) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    dateKey = toDateKey(tomorrow);
    text = text.replace(TOMORROW_RE, ' ');
  } else {
    const dmyMatch = text.match(/(?:^|\s)(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?=\s|$)/);
    if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10);
      const month = parseInt(dmyMatch[2], 10);
      const yearPart = dmyMatch[3];
      const year = yearPart
        ? yearPart.length === 2
          ? 2000 + parseInt(yearPart, 10)
          : parseInt(yearPart, 10)
        : now.getFullYear();
      const candidate = new Date(year, month - 1, day);
      // Rejects impossible dates ("31/02") instead of letting Date roll
      // them over into the next month silently.
      if (candidate.getMonth() === month - 1 && candidate.getDate() === day) {
        dateKey = toDateKey(candidate);
        text = text.replace(dmyMatch[0], ' ');
      }
    } else {
      const weekdayName = WEEKDAY_NAMES_LONGEST_FIRST.find((name) =>
        new RegExp(`(^|\\s)${escapeRegExp(name)}(?=\\s|$)`, 'i').test(text),
      );
      if (weekdayName) {
        dateKey = toDateKey(nextWeekday(now, WEEKDAYS[weekdayName]));
        text = text.replace(new RegExp(`(^|\\s)${escapeRegExp(weekdayName)}(?=\\s|$)`, 'i'), ' ');
      }
    }
  }

  // Connectors left dangling after the date phrase is removed
  // ("Entrega de X para" -> "Entrega de X").
  text = text.replace(/\s+(para|em|no|na|on|by|for)\s*$/i, '');
  text = text.replace(/\s{2,}/g, ' ').trim();

  return { title: text || raw.trim(), date: dateKey, time };
}

// Same convention as buildTaskDate in utils/taskPayload.ts: date-only ->
// UTC midnight of that calendar day; with a time -> local wall-clock time
// converted to a real instant, so it shows up at the hour that was typed.
export function quickAddToIsoDate(dateKey: string, time: string | null): string {
  if (!time) return new Date(dateKey).toISOString();
  const [year, month, day] = dateKey.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes).toISOString();
}
