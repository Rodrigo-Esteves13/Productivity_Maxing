import type { AcademicPeriod, Task } from '../../types/models';
import { GaugeIcon } from '../UI/Icons';

interface PeriodProgressBarProps {
  period: AcademicPeriod;
  tasks: Task[];
}

// Compares how much of the period has elapsed (by date) against how many
// of its tasks are actually done - a quick "am I keeping pace" signal.
// Only renders when the period has an endDate: without one there's no
// time-based percentage to compute (an ongoing/open-ended period).
export default function PeriodProgressBar({ period, tasks }: PeriodProgressBarProps) {
  if (!period.endDate) return null;

  const start = new Date(period.startDate).getTime();
  const end = new Date(period.endDate).getTime();
  const now = Date.now();
  if (end <= start) return null;

  const timeElapsedPct = Math.min(Math.max((now - start) / (end - start), 0), 1) * 100;

  const completedCount = tasks.filter((t) => t.progressStatus === 'COMPLETED').length;
  const tasksDonePct = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;

  const isBehindPace = tasksDonePct < timeElapsedPct - 10; // 10pt margin before flagging it

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 mb-6 shadow-xl">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs uppercase tracking-wide text-neutral-500 flex items-center gap-1.5">
          <GaugeIcon className="shrink-0" />
          Pace: {period.name}
        </p>
        {isBehindPace && (
          <span className="text-xs text-orange-400">Behind the period's pace</span>
        )}
      </div>

      <div className="space-y-2">
        <div>
          <div className="flex justify-between text-xs text-neutral-500 mb-1">
            <span>Time elapsed</span>
            <span>{timeElapsedPct.toFixed(0)}%</span>
          </div>
          <div className="h-2 rounded-full bg-neutral-800 overflow-hidden">
            <div
              className="h-full bg-neutral-500"
              style={{ width: `${timeElapsedPct}%` }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs text-neutral-500 mb-1">
            <span>Tasks completed</span>
            <span>
              {completedCount}/{tasks.length} ({tasksDonePct.toFixed(0)}%)
            </span>
          </div>
          <div className="h-2 rounded-full bg-neutral-800 overflow-hidden">
            <div
              className={`h-full ${isBehindPace ? 'bg-orange-500' : 'bg-violet-500'}`}
              style={{ width: `${tasksDonePct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
