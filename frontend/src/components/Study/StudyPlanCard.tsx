import { useStudyPlan } from '../../hooks/useStudyPlan';
import LoadingState from '../UI/LoadingState';
import ErrorState from '../UI/ErrorState';
import EmptyState from '../UI/EmptyState';
import { AlertTriangleIcon } from '../UI/Icons';
import type { StudyPlanSuggestion } from '../../types/models';

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function formatDayLabel(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

export default function StudyPlanCard() {
  const { plan, isLoading, error } = useStudyPlan(7);

  const byDay = new Map<string, StudyPlanSuggestion[]>();
  for (const s of plan?.suggestions ?? []) {
    const list = byDay.get(s.date) ?? [];
    list.push(s);
    byDay.set(s.date, list);
  }
  const days = [...byDay.keys()].sort();

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6">
      <h2 className="text-lg font-semibold text-white mb-1">Suggested study plan</h2>
      <p className="text-sm text-neutral-400 mb-4">
        Next 7 days, fitted around your classes, commute and quiet hours.
      </p>

      {isLoading && <LoadingState message="Building your plan..." />}
      {!isLoading && error && <ErrorState message={error} />}

      {!isLoading && !error && days.length === 0 && (
        <EmptyState message="No pending tasks with a deadline in the next 7 days, or no free time to fit them in." />
      )}

      {!isLoading && !error && days.length > 0 && (
        <div className="space-y-3">
          {days.map((day) => (
            <div key={day}>
              <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1.5">
                {formatDayLabel(day)}
              </p>
              <div className="space-y-1.5">
                {(byDay.get(day) ?? []).map((s, i) => (
                  <div
                    key={`${s.taskId}-${i}`}
                    className="flex items-center justify-between text-sm bg-neutral-800/60 rounded-lg px-3 py-2"
                  >
                    <span className="text-neutral-200">{s.taskTitle}</span>
                    <span className="text-neutral-500 shrink-0 ml-3">
                      {formatMinutes(s.startMinutes)}-{formatMinutes(s.endMinutes)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && !error && (plan?.warnings.length ?? 0) > 0 && (
        <div className="mt-4 space-y-1.5">
          {plan?.warnings.map((w, i) => (
            <div
              key={i}
              className="flex items-start gap-2 text-xs text-amber-400 bg-amber-950/20 border border-amber-900/40 rounded-lg p-2.5"
            >
              <AlertTriangleIcon className="shrink-0 mt-0.5" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
