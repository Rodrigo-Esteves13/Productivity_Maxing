import { useEffect, useState } from 'react';
import {
  getPeriodAverage,
  getProgramAverage,
  getPeriodsComparison,
} from '../../api/academicService';
import type { PeriodAverage, ProgramAverage, PeriodComparisonEntry } from '../../types/models';
import { useAcademic } from '../../context/useAcademic';
import GpaTrendChart from './GpaTrendChart';
import CreditSimulator from './CreditSimulator';

function formatAverage(average: number | null, scale: string): string {
  if (average === null) return '—';
  return `${average.toFixed(2)} / ${scale.split('-')[1] ?? scale}`;
}

// Card with the 3 average levels from Phase 5:
// 1. active period, 2. program cumulative (archived included),
// 3. comparison between periods of the same program (never cross-program).
interface GpaSummaryProps {
  showCreditSimulator?: boolean;
}

export default function GpaSummary({ showCreditSimulator = true }: GpaSummaryProps) {
  const { activeProgram, activePeriod, isViewingAllPeriods } = useAcademic();

  const [periodAverage, setPeriodAverage] = useState<PeriodAverage | null>(null);
  const [programAverage, setProgramAverage] = useState<ProgramAverage | null>(null);
  const [comparison, setComparison] = useState<PeriodComparisonEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!activeProgram) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const [programAvg, comparisonData, periodAvg] = await Promise.all([
          getProgramAverage(activeProgram.id),
          getPeriodsComparison(activeProgram.id),
          // "View all periods" doesn't have a single period to show its
          // own average for - only the program cumulative makes sense in
          // that case.
          !isViewingAllPeriods && activePeriod
            ? getPeriodAverage(activePeriod.id)
            : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setProgramAverage(programAvg);
        setComparison(comparisonData);
        setPeriodAverage(periodAvg);
      } catch (err) {
        console.error('Failed to load GPA data:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeProgram, activePeriod, isViewingAllPeriods]);

  if (!activeProgram || isLoading) return null;

  const scale = activeProgram.gradeScale;

  return (
    <>
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 mb-4 shadow-xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {!isViewingAllPeriods && periodAverage && (
          <div>
            <p className="text-xs uppercase tracking-wide text-neutral-500">
              Average — {periodAverage.periodName}
            </p>
            <p className="text-2xl font-bold text-violet-400">
              {formatAverage(periodAverage.average, scale)}
            </p>
            <p className="text-xs text-neutral-500">
              {periodAverage.gradedTaskCount} graded task(s)
            </p>
          </div>
        )}

        {programAverage && (
          <div>
            <p className="text-xs uppercase tracking-wide text-neutral-500">
              Cumulative average — {activeProgram.name}
            </p>
            <p className="text-2xl font-bold text-white">
              {formatAverage(programAverage.average, scale)}
            </p>
            <p className="text-xs text-neutral-500">
              {programAverage.gradedTaskCount} graded task(s) across all periods
            </p>
          </div>
        )}
      </div>

      {comparison.length > 1 && (
        <div className="mt-4 pt-4 border-t border-neutral-800">
          <p className="text-xs uppercase tracking-wide text-neutral-500 mb-2">
            Period comparison
          </p>
          <GpaTrendChart entries={comparison} scale={scale} />
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1">
            {comparison.map((entry) => (
              <div
                key={entry.periodId}
                className={`text-sm ${entry.isArchived ? 'text-neutral-500' : 'text-neutral-300'}`}
              >
                <span>{entry.periodName}: </span>
                <span className="font-semibold">{formatAverage(entry.average, scale)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>

    {showCreditSimulator && programAverage && (
      <div className="mb-6">
        <CreditSimulator programAverage={programAverage} scale={scale} />
      </div>
    )}
    </>
  );
}
