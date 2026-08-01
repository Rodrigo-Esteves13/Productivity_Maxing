import { useMemo, useState } from 'react';
import type { Task, Area } from '../../types/models';
import { TargetIcon } from '../UI/Icons';
import { computeWeightCoverage } from '../../utils/weightCoverage';

interface GradeNeededCalculatorProps {
  tasks: Task[];
  areas: Area[];
  scale: string;
}

const WHOLE_PERIOD_VALUE = '__whole_period__';

function scaleMax(scale: string): number {
  const parts = scale.split('-').map(Number);
  const max = parts[1];
  return Number.isFinite(max) && max > 0 ? max : 20;
}

// Inverts the same math as computeWeightedAverage on the backend
// (grade-average.util.ts): given a target average and the tasks already
// graded, solves for the average needed on the remaining ungraded,
// weighted tasks to reach it. Purely a frontend calculation over data the
// Dashboard already has loaded - no new endpoint needed.
export default function GradeNeededCalculator({ tasks, areas, scale }: GradeNeededCalculatorProps) {
  const max = scaleMax(scale);
  const areasWithTasks = useMemo(() => {
    const ids = new Set(tasks.map((t) => t.areaId));
    return areas.filter((a) => ids.has(a.id));
  }, [tasks, areas]);

  const [scope, setScope] = useState<string>(WHOLE_PERIOD_VALUE);
  const [target, setTarget] = useState<string>('');

  if (tasks.length === 0) return null;

  const scopedTasks = scope === WHOLE_PERIOD_VALUE ? tasks : tasks.filter((t) => t.areaId === scope);

  const graded = scopedTasks.filter((t) => t.realGrade !== null);
  const ungraded = scopedTasks.filter((t) => t.realGrade === null);

  const weightedSumGraded = graded.reduce(
    (sum, t) => sum + t.realGrade! * (t.weightPercentage ?? 1),
    0,
  );
  const totalWeightGraded = graded.reduce((sum, t) => sum + (t.weightPercentage ?? 1), 0);
  const remainingWeightFromTasks = ungraded.reduce((sum, t) => sum + (t.weightPercentage ?? 1), 0);

  // Within a single course, weights are expected to add up to 100% of the
  // final grade - but tasks get added over the semester as they're
  // announced, so what's on file right now (graded + ungraded) may fall
  // short of that (e.g. a final exam not yet turned into a task). That
  // gap is itself "remaining weight" to solve for, even with no task
  // representing it yet - only computed for a single-area scope (across
  // the whole period, weight isn't on a shared 100% basis - Areas are
  // combined by credits instead) and only when every task in scope has an
  // explicit weightPercentage (see computeWeightCoverage).
  const isSingleArea = scope !== WHOLE_PERIOD_VALUE;
  const coverage = computeWeightCoverage(scopedTasks);
  const weightGap =
    isSingleArea && coverage.allWeighted ? Math.max(0, 100 - coverage.totalWeight) : 0;

  const remainingWeight = remainingWeightFromTasks + weightGap;

  const targetNum = Number(target);
  const hasValidTarget = target !== '' && !Number.isNaN(targetNum);

  let neededAverage: number | null = null;
  if (hasValidTarget && remainingWeight > 0) {
    neededAverage =
      (targetNum * (totalWeightGraded + remainingWeight) - weightedSumGraded) / remainingWeight;
  }

  const impossible = neededAverage !== null && (neededAverage > max || neededAverage < 0);

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 shadow-xl">
      <p className="text-xs uppercase tracking-wide text-neutral-500 mb-3 flex items-center gap-1.5">
        <TargetIcon className="shrink-0" />
        What do I need on what's left?
      </p>

      <div className="flex flex-wrap gap-2 mb-3">
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          className="border border-neutral-700 bg-neutral-900 text-white rounded-lg px-2 py-1.5 text-sm"
        >
          <option value={WHOLE_PERIOD_VALUE}>Whole period</option>
          {areasWithTasks.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </select>

        <input
          type="number"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder={`Target average (e.g. ${(max * 0.8).toFixed(0)})`}
          min={0}
          max={max}
          step="0.1"
          className="flex-1 min-w-[140px] border border-neutral-700 bg-neutral-900 text-white rounded-lg px-3 py-1.5 text-sm placeholder:text-neutral-500"
        />
      </div>

      {weightGap > 0 && (
        <p className="text-xs text-amber-400 mb-2">
          Tasks on file for this course only add up to {coverage.totalWeight.toFixed(0)}% of the
          grade - treating the missing {weightGap.toFixed(0)}% as still to be graded.
        </p>
      )}

      {!hasValidTarget && (
        <p className="text-sm text-neutral-500">Set a target average to see what you need.</p>
      )}

      {hasValidTarget && remainingWeight === 0 && (
        <p className="text-sm text-neutral-500">
          No ungraded tasks left in this scope - nothing left to influence the average.
        </p>
      )}

      {hasValidTarget && remainingWeight > 0 && neededAverage !== null && (
        <p className={`text-sm ${impossible ? 'text-red-400' : 'text-neutral-200'}`}>
          You need an average of{' '}
          <span className="font-bold text-lg">{neededAverage.toFixed(2)}</span> on the{' '}
          {ungraded.length > 0
            ? `${ungraded.length} remaining task(s)${weightGap > 0 ? ' plus the ungraded part of the course' : ''}`
            : 'ungraded part of the course'}{' '}
          to reach {targetNum.toFixed(2)}.
          {impossible && ' Not achievable within this grade scale.'}
        </p>
      )}
    </div>
  );
}

