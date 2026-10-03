import { useMemo } from 'react';
import type { Task, Area } from '../../types/models';
import { ChartPieIcon } from '../UI/Icons';
import { computeWeightCoverage } from '../../utils/weightCoverage';
import Sparkline from '../UI/Sparkline';
import ProgressBar from '../UI/ProgressBar';
import DashboardCard, { CardHeading } from '../UI/DashboardCard';
import ColorDot from '../UI/ColorDot';

interface AreaBreakdownCardProps {
  tasks: Task[];
  areas: Area[];
  scale: string;
}

function scaleMax(scale: string): number {
  const parts = scale.split('-').map(Number);
  const max = parts[1];
  return Number.isFinite(max) && max > 0 ? max : 20;
}

interface AreaRow {
  area: Area;
  average: number | null;
  gradedCount: number;
  // Percent of the course's weight actually on file (graded + ungraded
  // tasks combined) - null when tasks in this Area don't all have an
  // explicit weightPercentage (see computeWeightCoverage), in which case
  // there's nothing meaningful to compare against 100%.
  weightCoveredPct: number | null;
  // realGrade of every graded task in this Area, oldest first - the
  // sequence the sparkline draws. Not the running average, the individual
  // grades themselves - a dip on one hard test should be visible, not
  // smoothed away.
  gradeHistory: number[];
}

// Same per-Area weighted average as the backend's computeWeightedAverage
// (grade-average.util.ts), run client-side over the tasks the Dashboard
// already has loaded - avoids yet another endpoint for what's really just
// a different view of data already on the page.
function computeAreaAverage(tasks: Task[]): { average: number | null; gradedCount: number } {
  const graded = tasks.filter((t) => t.realGrade !== null);
  if (graded.length === 0) return { average: null, gradedCount: 0 };
  const weightedSum = graded.reduce((sum, t) => sum + t.realGrade! * (t.weightPercentage ?? 1), 0);
  const totalWeight = graded.reduce((sum, t) => sum + (t.weightPercentage ?? 1), 0);
  return {
    average: totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : null,
    gradedCount: graded.length,
  };
}

function computeGradeHistory(tasks: Task[]): number[] {
  return tasks
    .filter((t) => t.realGrade !== null)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((t) => t.realGrade!);
}

export default function AreaBreakdownCard({ tasks, areas, scale }: AreaBreakdownCardProps) {
  const max = scaleMax(scale);

  const rows = useMemo<AreaRow[]>(() => {
    return areas
      .map((area) => {
        const areaTasks = tasks.filter((t) => t.areaId === area.id);
        const { average, gradedCount } = computeAreaAverage(areaTasks);
        const coverage = computeWeightCoverage(areaTasks);
        return {
          area,
          average,
          gradedCount,
          weightCoveredPct: coverage.allWeighted ? coverage.totalWeight : null,
          gradeHistory: computeGradeHistory(areaTasks),
        };
      })
      .filter((row) => row.gradedCount > 0)
      .sort((a, b) => (b.average ?? 0) - (a.average ?? 0));
  }, [tasks, areas]);

  if (rows.length === 0) return null;

  return (
    <DashboardCard>
      <CardHeading className="mb-3">
        <ChartPieIcon className="shrink-0" />
        Breakdown by course
      </CardHeading>
      <ul className="space-y-3">
        {rows.map(({ area, average, weightCoveredPct, gradeHistory }) => (
          <li key={area.id}>
            <div className="flex items-center justify-between text-sm mb-1">
              <div className="flex items-center gap-2 min-w-0">
                <ColorDot size="xs" color={area.colorHex} />
                <span className="truncate text-neutral-200">{area.name}</span>
                <span className="text-xs text-neutral-500 shrink-0">
                  {area.credits ? `${area.credits} credits` : 'no credits set'}
                </span>
                {weightCoveredPct !== null && weightCoveredPct < 100 && (
                  <span
                    className="text-xs text-amber-400 shrink-0"
                    title="Percent of this course's weight covered by tasks on file - the rest isn't graded yet, so this average is preliminary"
                  >
                    {weightCoveredPct.toFixed(0)}% of grade so far
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Sparkline
                  values={gradeHistory}
                  max={max}
                  className="shrink-0"
                />
                <span className="font-semibold text-neutral-200">
                  {average !== null ? average.toFixed(2) : '-'}
                </span>
              </div>
            </div>
            <ProgressBar percent={average !== null ? (average / max) * 100 : 0} />
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
}
