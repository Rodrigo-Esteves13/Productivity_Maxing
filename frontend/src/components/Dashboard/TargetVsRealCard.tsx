import { useMemo } from 'react';
import type { Task, Area } from '../../types/models';
import { computeTargetVsReal } from '../../utils/targetVsReal';
import { TargetIcon } from '../UI/Icons';
import DashboardCard, { CardHeading } from '../UI/DashboardCard';
import ColorDot from '../UI/ColorDot';

interface TargetVsRealCardProps {
  tasks: Task[];
  areas: Area[];
  scale: string;
}

function scaleMax(scale: string): number {
  const max = Number(scale.split('-')[1]);
  return Number.isFinite(max) && max > 0 ? max : 20;
}

// Target vs actual grade per course. AreaBreakdownCard shows where each
// course stands; this shows how far that is from what was aimed for.
export default function TargetVsRealCard({ tasks, areas, scale }: TargetVsRealCardProps) {
  const rows = useMemo(() => computeTargetVsReal(tasks, areas), [tasks, areas]);
  if (rows.length === 0) return null;

  const max = scaleMax(scale);

  return (
    <DashboardCard>
      <CardHeading className="mb-3">
        <TargetIcon className="shrink-0" />
        Target vs real
      </CardHeading>
      <ul className="space-y-3">
        {rows.slice(0, 6).map((row) => (
          <li key={row.area.id} className="text-sm">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <ColorDot size="xs" color={row.area.colorHex} />
                <span className="truncate text-neutral-200">{row.area.name}</span>
              </div>
              <span
                className={`text-xs shrink-0 ${
                  row.gap >= 0 ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {row.gap >= 0 ? '+' : ''}
                {row.gap.toFixed(1)}
              </span>
            </div>
            <div className="relative h-2 rounded-full bg-neutral-800">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-violet-500"
                style={{ width: `${Math.min((row.avgReal / max) * 100, 100)}%` }}
              />
              <div
                className="absolute -top-0.5 -bottom-0.5 w-0.5 bg-white"
                style={{ left: `${Math.min((row.avgTarget / max) * 100, 100)}%` }}
                title={`Target ${row.avgTarget}`}
              />
            </div>
            <p className="text-[10px] text-neutral-500 mt-1">
              Real {row.avgReal} / target {row.avgTarget} - {row.taskCount} graded task
              {row.taskCount === 1 ? '' : 's'}
            </p>
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
}
