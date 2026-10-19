import { FULL_PERCENT } from '../../lib/percent';
import { useMemo } from 'react';
import type { Task, Area } from '../../types/models';
import { ChartPieIcon } from '../UI/Icons';
import { computeWeightCoverage } from '../../utils/weightCoverage';
import { usePeriodGradeComponents } from '../../hooks/usePeriodGradeComponents';
import type { GradeComponent } from '../../types/models';
import Sparkline from '../UI/Sparkline';
import ProgressBar from '../UI/ProgressBar';
import DashboardCard, { CardHeading } from '../UI/DashboardCard';
import ColorDot from '../UI/ColorDot';
import { useI18n } from '../../i18n/useI18n';

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
function computeAreaAverage(
  tasks: Task[],
  components: GradeComponent[],
): { average: number | null; gradedCount: number } {
  // Componentes (seminarios, participacao...) entram como uma task com a
  // nota agregada e o peso do componente - igual ao backend.
  const items = [
    ...tasks
      .filter((t) => t.realGrade !== null)
      .map((t) => ({ grade: t.realGrade!, weight: t.weightPercentage ?? 1 })),
    ...components
      .filter((c) => c.grade !== null)
      .map((c) => ({ grade: c.grade!, weight: c.weightPercentage })),
  ];
  if (items.length === 0) return { average: null, gradedCount: 0 };
  const weightedSum = items.reduce((sum, i) => sum + i.grade * i.weight, 0);
  const totalWeight = items.reduce((sum, i) => sum + i.weight, 0);
  return {
    average: totalWeight > 0 ? Math.round((weightedSum / totalWeight) * FULL_PERCENT) / FULL_PERCENT : null,
    gradedCount: items.length,
  };
}

// Peso da cadeira ja atribuido: tasks (se todas tiverem peso) + componentes.
function computeAreaCoverage(tasks: Task[], components: GradeComponent[]): number | null {
  const componentWeight = components.reduce((sum, c) => sum + c.weightPercentage, 0);
  if (tasks.length === 0) return components.length > 0 ? componentWeight : null;
  const coverage = computeWeightCoverage(tasks);
  return coverage.allWeighted ? coverage.totalWeight + componentWeight : null;
}

function computeGradeHistory(tasks: Task[]): number[] {
  return tasks
    .filter((t) => t.realGrade !== null)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((t) => t.realGrade!);
}

export default function AreaBreakdownCard({ tasks, areas, scale }: AreaBreakdownCardProps) {
  const { t } = useI18n();
  const max = scaleMax(scale);
  const components = usePeriodGradeComponents();

  const rows = useMemo<AreaRow[]>(() => {
    return areas
      .map((area) => {
        const areaTasks = tasks.filter((t) => t.areaId === area.id);
        const areaComponents = components.filter((c) => c.areaId === area.id);
        const { average, gradedCount } = computeAreaAverage(areaTasks, areaComponents);
        return {
          area,
          average,
          gradedCount,
          weightCoveredPct: computeAreaCoverage(areaTasks, areaComponents),
          gradeHistory: computeGradeHistory(areaTasks),
        };
      })
      .filter((row) => row.gradedCount > 0)
      .sort((a, b) => (b.average ?? 0) - (a.average ?? 0));
  }, [tasks, areas, components]);

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
                {weightCoveredPct !== null && weightCoveredPct < FULL_PERCENT && (
                  <span
                    className="text-xs text-amber-400 shrink-0"
                    title={t('ui.percentOfThisCourseS')}
                  >
                    {t('ui.ofGradeSoFar', { weightCoveredPct: weightCoveredPct.toFixed(0) })}</span>
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
            <ProgressBar percent={average !== null ? (average / max) * FULL_PERCENT : 0} />
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
}
