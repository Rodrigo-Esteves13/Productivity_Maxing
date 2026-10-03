import { useEffect, useState } from 'react';
import {
  getDailyStudyTotals,
  getStudyStreak,
  type DailyStudyTotal,
  type StudyStreak,
} from '../../api/studySessionsService';
import { ActivityIcon, FlameIcon } from '../UI/Icons';
import ProgressBar from '../UI/ProgressBar';
import DashboardCard, { CardHeading } from '../UI/DashboardCard';
import { todayKey } from '../../lib/dateKey';

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

// Combines two of the brainstormed dashboard ideas into one card since
// they share the same underlying data (daily study minutes): a
// GitHub-contributions-style activity heatmap with a streak counter, and
// today's study time against a goal.
//
// The streak itself (with freeze support) is computed backend-side from
// full session history, not from this card's WINDOW_DAYS window - see
// StudySessionsService.getStreak(). A local, window-only recount here
// would silently diverge from the backend's the moment someone's streak
// outlives WINDOW_DAYS, and would have no way to know about freezes at
// all (those depend on the full history too).
//
// The goal is local-only for now (a plain input, not persisted to the
// backend) - there's no "daily study goal" concept anywhere in the data
// model yet, and adding one felt like a separate decision. Easy to wire
// up to a real setting later if it's worth persisting.
//
// This week vs last week (added later) reuses the exact same `days`
// fetch - no separate endpoint or extra request, just a different sum
// over data this card already has on hand.
function sumLastNDays(days: DailyStudyTotal[], n: number, offsetFromEnd: number): number {
  const end = days.length - offsetFromEnd;
  const start = Math.max(0, end - n);
  return days.slice(start, end).reduce((sum, d) => sum + d.totalMinutes, 0);
}

function formatWeekMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

export default function StudyActivityCard() {
  const [days, setDays] = useState<DailyStudyTotal[]>([]);
  const [streak, setStreak] = useState<StudyStreak | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [goalMinutes, setGoalMinutes] = useState(DEFAULT_GOAL_MINUTES);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [totals, streakData] = await Promise.all([
          getDailyStudyTotals(WINDOW_DAYS),
          getStudyStreak(),
        ]);
        if (!cancelled) {
          setDays(totals);
          setStreak(streakData);
        }
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
  const today = todayKey();
  const todayMinutes = days.find((d) => d.date === today)?.totalMinutes ?? 0;
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
    <DashboardCard>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <CardHeading>
          <ActivityIcon className="shrink-0" />
          Study activity
        </CardHeading>
        {streak && streak.currentStreak > 0 && (
          <span
            className={`flex items-center gap-2 text-sm font-semibold ${
              streak.atRisk ? 'text-amber-400' : 'text-violet-400'
            }`}
          >
            <span className="flex items-center gap-1">
              <FlameIcon className="shrink-0" />
              {streak.currentStreak} day{streak.currentStreak === 1 ? '' : 's'}
            </span>
            {streak.freezesAvailable > 0 && (
              <span
                className="text-xs text-sky-400 font-normal"
                title={`${streak.freezesAvailable} freeze${streak.freezesAvailable === 1 ? '' : 's'} banked - auto-covers a missed day`}
              >
                {streak.freezesAvailable} freeze{streak.freezesAvailable === 1 ? '' : 's'}
              </span>
            )}
            {streak.atRisk && (
              <span className="text-xs font-normal">study today to keep it</span>
            )}
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
        <ProgressBar
          thickness="md"
          percent={goalPct}
          fillClassName={goalPct >= 100 ? 'bg-sky-500' : 'bg-violet-500'}
        />
      </div>

      {(() => {
        const thisWeek = sumLastNDays(days, 7, 0);
        const lastWeek = sumLastNDays(days, 7, 7);
        if (thisWeek === 0 && lastWeek === 0) return null;
        const deltaPct =
          lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : null;
        return (
          <div className="mt-3 pt-3 border-t border-neutral-800 flex items-center justify-between text-xs text-neutral-500">
            <span>
              This week: <span className="text-neutral-300">{formatWeekMinutes(thisWeek)}</span>
            </span>
            <span>
              vs last week: <span className="text-neutral-300">{formatWeekMinutes(lastWeek)}</span>
              {deltaPct !== null && (
                <span className={deltaPct >= 0 ? 'text-emerald-400' : 'text-neutral-400'}>
                  {' '}
                  ({deltaPct >= 0 ? '+' : ''}
                  {deltaPct}%)
                </span>
              )}
            </span>
          </div>
        );
      })()}
    </DashboardCard>
  );
}
