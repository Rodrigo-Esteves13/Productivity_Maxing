import type { PeriodReportCard, StudySession, Task } from '../types/models';
import { toLocalDayKey } from '../utils/profileStats';

const MS_PER_DAY = 86_400_000;
const SECONDS_PER_MINUTE = 60;
// The study history endpoint never returns more than this many days.
export const HISTORY_MAX_DAYS = 90;
// A streak shorter than this is not worth a card.
export const MIN_STREAK_DAYS = 2;

export type PeriodReviewCard =
  | { kind: 'tasksCompleted'; count: number }
  | { kind: 'studyTime'; minutes: number; sessionCount: number }
  | { kind: 'bestDay'; dayKey: string; minutes: number }
  | { kind: 'bestArea'; areaName: string; average: number }
  | { kind: 'bestWeekday'; weekday: number; minutes: number }
  | { kind: 'longestStreak'; days: number };

export interface PeriodReviewInput {
  card: PeriodReportCard | null;
  tasks: Task[];
  sessions: StudySession[];
  /** Period bounds (ISO). Sessions outside them are ignored. */
  startDate: string | null;
  endDate: string | null;
}

/** How many history days to request so the whole period (up to the cap) is covered. */
export function historyDaysForPeriod(startDate: string | null, now: Date = new Date()): number {
  if (!startDate) return HISTORY_MAX_DAYS;
  const elapsed = Math.ceil((now.getTime() - new Date(startDate).getTime()) / MS_PER_DAY) + 1;
  return Math.min(HISTORY_MAX_DAYS, Math.max(1, elapsed));
}

function sessionsInPeriod(sessions: StudySession[], startDate: string | null, endDate: string | null) {
  const from = startDate ? new Date(startDate).getTime() : -Infinity;
  const to = endDate ? new Date(endDate).getTime() + MS_PER_DAY : Infinity;
  return sessions.filter((s) => {
    if (!s.durationSeconds || s.durationSeconds <= 0) return false;
    const at = new Date(s.startedAt).getTime();
    return at >= from && at < to;
  });
}

/** Key with the highest total; ties go to the smallest key. */
function topEntry<K extends string | number>(totals: Map<K, number>): [K, number] | null {
  let best: [K, number] | null = null;
  for (const entry of totals) {
    if (!best || entry[1] > best[1] || (entry[1] === best[1] && entry[0] < best[0])) best = entry;
  }
  return best;
}

/** Longest run of consecutive local days that have at least one entry. */
export function longestDayStreak(dayKeys: Iterable<string>): number {
  const days = [...new Set(dayKeys)].sort();
  let longest = 0;
  let run = 0;
  let previous: number | null = null;
  for (const key of days) {
    const [y, m, d] = key.split('-').map(Number);
    const at = Date.UTC(y, m - 1, d);
    run = previous !== null && at - previous === MS_PER_DAY ? run + 1 : 1;
    previous = at;
    if (run > longest) longest = run;
  }
  return longest;
}

// Cards with no data are left out, so an empty list means nothing to show.
export function buildPeriodReview(input: PeriodReviewInput): PeriodReviewCard[] {
  const cards: PeriodReviewCard[] = [];

  const completed = input.tasks.filter((task) => task.completedAt).length;
  if (completed > 0) cards.push({ kind: 'tasksCompleted', count: completed });

  const sessions = sessionsInPeriod(input.sessions, input.startDate, input.endDate);
  if (sessions.length > 0) {
    const byDay = new Map<string, number>();
    const byWeekday = new Map<number, number>();
    let totalSeconds = 0;
    for (const s of sessions) {
      const seconds = s.durationSeconds ?? 0;
      const started = new Date(s.startedAt);
      const dayKey = toLocalDayKey(started);
      totalSeconds += seconds;
      byDay.set(dayKey, (byDay.get(dayKey) ?? 0) + seconds);
      byWeekday.set(started.getDay(), (byWeekday.get(started.getDay()) ?? 0) + seconds);
    }
    const toMinutes = (seconds: number) => Math.round(seconds / SECONDS_PER_MINUTE);
    cards.push({ kind: 'studyTime', minutes: toMinutes(totalSeconds), sessionCount: sessions.length });
    const bestDay = topEntry(byDay);
    if (bestDay) cards.push({ kind: 'bestDay', dayKey: bestDay[0], minutes: toMinutes(bestDay[1]) });
    const bestWeekday = byWeekday.size > 1 ? topEntry(byWeekday) : null;
    if (bestWeekday) cards.push({ kind: 'bestWeekday', weekday: bestWeekday[0], minutes: toMinutes(bestWeekday[1]) });
    const streak = longestDayStreak(byDay.keys());
    if (streak >= MIN_STREAK_DAYS) cards.push({ kind: 'longestStreak', days: streak });
  }

  const graded = (input.card?.areas ?? []).filter((a) => a.average !== null);
  if (graded.length > 0) {
    const best = graded.reduce((top, a) => ((a.average ?? 0) > (top.average ?? 0) ? a : top));
    cards.push({ kind: 'bestArea', areaName: best.areaName, average: best.average ?? 0 });
  }

  return cards;
}
