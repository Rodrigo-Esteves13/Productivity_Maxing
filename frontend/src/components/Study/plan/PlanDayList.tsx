import type { StudyPlanDay, StudyPlanSuggestion } from '../../../types/models';
import { formatClock, formatDayLabel, formatDuration } from '../../../lib/timeFormat';

interface PlanDayListProps {
  suggestions: StudyPlanSuggestion[];
  days: StudyPlanDay[];
  dailyLimitMinutes: number;
}

function groupByDay(suggestions: StudyPlanSuggestion[]): Map<string, StudyPlanSuggestion[]> {
  const byDay = new Map<string, StudyPlanSuggestion[]>();
  for (const s of suggestions) {
    const list = byDay.get(s.date) ?? [];
    list.push(s);
    byDay.set(s.date, list);
  }
  return byDay;
}

export default function PlanDayList({ suggestions, days, dailyLimitMinutes }: PlanDayListProps) {
  const byDay = groupByDay(suggestions);
  const visibleDays = days.filter((d) => byDay.has(d.date));

  return (
    <section aria-labelledby="plan-days-heading">
      <h3
        id="plan-days-heading"
        className="text-xs uppercase tracking-wide text-neutral-500 mb-2"
      >
        Day by day
      </h3>
      <div className="space-y-4">
        {visibleDays.map((day) => {
          const loadPct = Math.min(100, Math.round((day.studyMinutes / dailyLimitMinutes) * 100));
          return (
            <div key={day.date}>
              <div className="flex items-baseline justify-between mb-1.5">
                <p className="text-sm font-medium text-neutral-200">{formatDayLabel(day.date)}</p>
                <p className="text-xs text-neutral-500">
                  {formatDuration(day.studyMinutes)} study
                  {day.classMinutes > 0 && ` · ${formatDuration(day.classMinutes)} class`}
                  {day.workMinutes > 0 && ` · ${formatDuration(day.workMinutes)} work`}
                </p>
              </div>
              <div
                className="h-1 rounded-full bg-neutral-800 overflow-hidden mb-2"
                aria-hidden="true"
              >
                <div
                  className={`h-full ${day.overtimeMinutes > 0 ? 'bg-amber-500' : 'bg-violet-500'}`}
                  style={{ width: `${loadPct}%` }}
                />
              </div>
              <ul className="space-y-1.5">
                {(byDay.get(day.date) ?? []).map((s) => (
                  <li
                    key={`${s.taskId}-${s.startMinutes}`}
                    className={`flex items-center justify-between text-sm rounded-lg px-3 py-2 ${
                      s.isOvertime
                        ? 'bg-amber-950/20 border border-amber-900/40'
                        : 'bg-neutral-800/60'
                    }`}
                  >
                    <span className="text-neutral-200 truncate">{s.taskTitle}</span>
                    <span className="text-neutral-500 shrink-0 ml-3">
                      {s.isOvertime && <span className="text-amber-400 mr-2">Overtime</span>}
                      {formatClock(s.startMinutes)}-{formatClock(s.endMinutes)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
