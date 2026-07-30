import { useEffect, useState } from 'react';
import {
  getPeriodAverage,
  getProgramAverage,
  getPeriodsComparison,
} from '../../api/academicService';
import type { PeriodAverage, ProgramAverage, PeriodComparisonEntry } from '../../types/models';
import { useAcademic } from '../../context/useAcademic';
import GpaTrendChart from './GpaTrendChart';
import SparklineMini from './SparklineMini';
import CreditSimulator from './CreditSimulator';
import { ClockIcon, GraduationCapIcon, TrendingUpIcon } from '../UI/Icons';

function formatAverage(average: number | null, scale: string): string {
  if (average === null) return '-';
  return `${average.toFixed(2)} / ${scale.split('-')[1] ?? scale}`;
}

// Glassmorphic stat card: translucent blurred background, soft border,
// glow blob behind it that picks up the accent color.
function StatCard({
  icon,
  label,
  value,
  valueClassName,
  sub,
  sparklineData,
  sparklineColor,
  mounted,
  delayMs = 0,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClassName: string;
  sub: string;
  sparklineData: { value: number | null }[];
  sparklineColor: string;
  mounted: boolean;
  delayMs?: number;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/40 backdrop-blur-xl p-4 shadow-xl shadow-black/40 transition-all duration-500 ease-out ${
        mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
      style={{ transitionDelay: `${delayMs}ms` }}
    >
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full blur-2xl"
        style={{ backgroundColor: `${sparklineColor}22` }}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-500 flex items-center gap-1.5">
            {icon}
            {label}
          </p>
          <p className={`text-2xl font-bold ${valueClassName}`}>{value}</p>
          <p className="text-xs text-neutral-500">{sub}</p>
        </div>
        <SparklineMini data={sparklineData} color={sparklineColor} className="h-10 w-16 shrink-0" />
      </div>
    </div>
  );
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
  const [mounted, setMounted] = useState(false);

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

  // Triggers the cards' fade/slide-in on next paint, after data is ready.
  useEffect(() => {
    if (isLoading) {
      setMounted(false);
      return;
    }
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, [isLoading]);

  if (!activeProgram || isLoading) return null;

  const scale = activeProgram.gradeScale;
  const sparklineData = comparison.map((entry) => ({ value: entry.average }));

  return (
    <>
    <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
      {!isViewingAllPeriods && periodAverage && (
        <StatCard
          icon={<ClockIcon className="shrink-0" />}
          label={`Average: ${periodAverage.periodName}`}
          value={formatAverage(periodAverage.average, scale)}
          valueClassName="text-violet-300"
          sub={`${periodAverage.gradedTaskCount} graded task(s)`}
          sparklineData={sparklineData}
          sparklineColor="#a78bfa"
          mounted={mounted}
          delayMs={0}
        />
      )}

      {programAverage && (
        <StatCard
          icon={<GraduationCapIcon className="shrink-0" />}
          label={`Cumulative average: ${activeProgram.name}`}
          value={formatAverage(programAverage.average, scale)}
          valueClassName="text-white"
          sub={`${programAverage.gradedTaskCount} graded task(s) across all periods`}
          sparklineData={sparklineData}
          sparklineColor="#818cf8"
          mounted={mounted}
          delayMs={80}
        />
      )}
    </div>

    {comparison.length > 1 && (
      <div
        className={`relative overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/40 backdrop-blur-xl p-4 mb-4 shadow-xl shadow-black/40 transition-all duration-500 ease-out ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        }`}
        style={{ transitionDelay: '160ms' }}
      >
        <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1 flex items-center gap-1.5">
          <TrendingUpIcon className="shrink-0" />
          Period comparison
        </p>
        <GpaTrendChart
          entries={comparison}
          scale={scale}
          cumulativeAverage={programAverage?.average ?? null}
        />
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t border-white/10 pt-3">
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

    {showCreditSimulator && programAverage && (
      <div className="mb-6">
        <CreditSimulator programAverage={programAverage} scale={scale} />
      </div>
    )}
    </>
  );
}
