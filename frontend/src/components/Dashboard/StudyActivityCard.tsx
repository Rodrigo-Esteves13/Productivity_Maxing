import { useEffect, useState } from 'react';
import { getDailyStudyTotals, type DailyStudyTotal } from '../../api/studySessionsService';

const WINDOW_DAYS = 84; // ~12 weeks, GitHub-contributions-style grid
const DEFAULT_GOAL_MINUTES = 60;

function intensityClass(minutes: number, maxMinutes: number): string {
  if (minutes === 0 || maxMinutes === 0) return 'bg-neutral-900 border-neutral-800';
  const ratio = minutes / maxMinutes;
  if (ratio > 0.75) return 'bg-violet-500 border-violet-400';
  if (ratio > 0.5) return 'bg-violet-600/70 border-violet-600/60';
  if (ratio > 0.25) return 'bg-violet-700/50 border-violet-700/40';
  return 'bg-violet-800/30 border-violet-800/30';
}

// Counts the current streak of consecutive days with study time, walking
// backwards from today. If today has no time logged yet, that's not a
// broken streak (the day isn't over) - it just starts counting from
// yesterday instead.
function computeStreak(days: DailyStudyTotal[]): number {
  const byDate = new Map(days.map((d) => [d.date, d.totalMinutes]));
  let streak = 0;
  const cursor = new Date();
  if ((byDate.get(cursor.toISOString().slice(0, 10)) ?? 0) === 0) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    const minutes = byDate.get(key);
    if (!minutes || minutes <= 0) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// Combines two of the brainstormed dashboard ideas into one card since
// they share the same underlying data (daily study minutes): a
// GitHub-contributions-style activity heatmap with a streak counter, and
// today's study time against a goal.
//
// The goal is local-only for now (a plain input, not persisted to the
// backend) - there's no "daily study goal" concept anywhere in the data
// model yet, and adding one felt like a separate decision. Easy to wire
// up to a real setting later if it's worth persisting.
export default function StudyActivityCard() {
  const [days, setDays] = useState<DailyStudyTotal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [goalMinutes, setGoalMinutes] = useState(DEFAULT_GOAL_MINUTES);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getDailyStudyTotals(WINDOW_DAYS);
        if (!cancelled) setDays(data);
      } catch (err) {
        console.error('Failed to load study activity:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) return null;

  const hasAnyData = days.some((d) => d.totalMinutes > 0);
  if (!hasAnyData) return null;

  const maxMinutes = Math.max(0, ...days.map((d) => d.totalMinutes));
  const streak = computeStreak(days);
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayMinutes = days.find((d) => d.date === todayKey)?.totalMinutes ?? 0;
  const goalPct = Math.min((todayMinutes / goalMinutes) * 100, 100);

  // Groups the flat day list into weeks (columns), Sunday-first, so it
  // reads left-to-right like a GitHub contributions graph.
  const weeks: DailyStudyTotal[][] = [];
  let currentWeek: DailyStudyTotal[] = [];
  days.forEach((day, index) => {
    const dayOfWeek = new Date(day.date).getUTCDay();
    if (index === 0) {
      for (let i = 0; i < dayOfWeek; i++) currentWeek.push({ date: '', totalMinutes: -1 });
    }
    currentWeek.push(day);
    if (dayOfWeek === 6) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  });
  if (currentWeek.length > 0) weeks.push(currentWeek);

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <p className="text-xs uppercase tracking-wide text-neutral-500">Study activity</p>
        {streak > 0 && (
          <span className="text-sm text-violet-400 font-semibold">
            {streak} day{streak === 1 ? '' : 's'} streak
          </span>
        )}
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1">
        {weeks.map((week, wIndex) => (
          <div key={wIndex} className="flex flex-col gap-1">
            {week.map((day, dIndex) =>
              day.totalMinutes === -1 ? (
                <div key={dIndex} className="w-3 h-3" />
              ) : (
                <div
                  key={day.date}
                  title={`${day.date}: ${day.totalMinutes} min`}
                  className={`w-3 h-3 rounded-sm border ${intensityClass(day.totalMinutes, maxMinutes)}`}
                />
              ),
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-neutral-800">
        <div className="flex items-center justify-between text-xs text-neutral-500 mb-1">
          <span>
            Today: {todayMinutes} / {' '}
            <input
              type="number"
              value={goalMinutes}
              onChange={(e) => setGoalMinutes(Math.max(1, Number(e.target.value) || 1))}
              className="w-14 bg-transparent border-b border-neutral-700 text-neutral-300 text-center"
            />{' '}
            min goal
          </span>
          <span>{goalPct.toFixed(0)}%</span>
        </div>
        <div className="h-2 rounded-full bg-neutral-800 overflow-hidden">
          <div
            className={`h-full ${goalPct >= 100 ? 'bg-emerald-500' : 'bg-violet-500'}`}
            style={{ width: `${goalPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
