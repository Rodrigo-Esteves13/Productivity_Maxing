import { lazy, Suspense, useEffect, useState } from 'react';
import {
  getPeriodAverage,
  getProgramAverage,
  getPeriodsComparison,
} from '../../api/academicService';
import type { PeriodAverage, ProgramAverage, PeriodComparisonEntry } from '../../types/models';
import { useAcademic } from '../../context/useAcademic';
import Sparkline from '../UI/Sparkline';
import Skeleton from '../UI/Skeleton';
import CreditSimulator from './CreditSimulator';
import { ClockIcon, GraduationCapIcon, TrendingUpIcon } from '../UI/Icons';
import { useI18n } from '../../i18n/useI18n';

function formatAverage(average: number | null, scale: string): string {
  if (average === null) return '-';
  return `${average.toFixed(2)} / ${scale.split('-')[1] ?? scale}`;
}

// recharts so e preciso para este grafico (e so com 2+ periodos): fica num
// chunk a parte em vez de atrasar o primeiro desenho do Dashboard.
const GpaTrendChart = lazy(() => import('./GpaTrendChart'));

// Cor de cada cartao (linha do sparkline + brilho de fundo), sempre tokens
// do Tailwind em vez de hex. O brilho e um gradiente radial (antes era um
// circulo com filter: blur(40px), com o mesmo aspeto mas pesado no Firefox).
const STAT_ACCENTS = {
  violet: { line: 'text-violet-400', glow: 'from-violet-400/8' },
  indigo: { line: 'text-indigo-400', glow: 'from-indigo-400/8' },
} as const;
type StatAccent = keyof typeof STAT_ACCENTS;

// Glassmorphic stat card: translucent background, soft border, glow blob
// behind it that picks up the accent color. Sem backdrop-blur: sobre o fundo
// liso da pagina o blur nao se via, mas o GPU tinha de o refazer a cada
// frame do scroll (medido: era a causa do Dashboard lento a fazer scroll).
function StatCard({
  icon,
  label,
  value,
  valueClassName,
  sub,
  sparklineData,
  accent,
  mounted,
  delayMs = 0,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClassName: string;
  sub: string;
  sparklineData: number[];
  accent: StatAccent;
  mounted: boolean;
  delayMs?: number;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 shadow-xl transition-[opacity,translate] duration-[var(--duration-slow)] ease-smooth-out ${
        mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
      style={{ transitionDelay: `${delayMs}ms` }}
    >
      <div
        className={`pointer-events-none absolute -right-22 -top-22 h-56 w-56 bg-radial-[closest-side] to-transparent ${STAT_ACCENTS[accent].glow}`}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-500 flex items-center gap-1.5">
            {icon}
            {label}
          </p>
          <p className={`text-2xl font-bold tabular-nums ${valueClassName}`}>{value}</p>
          <p className="text-xs text-neutral-500">{sub}</p>
        </div>
        <Sparkline
          values={sparklineData}
          width={64}
          height={40}
          filled
          colorClassName={STAT_ACCENTS[accent].line}
          className="shrink-0"
        />
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
  const { t } = useI18n();

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
  const sparklineData = comparison
    .map((entry) => entry.average)
    .filter((value): value is number => value !== null);

  return (
    <>
    <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
      {!isViewingAllPeriods && periodAverage && (
        <StatCard
          icon={<ClockIcon className="shrink-0" />}
          label={t('ui.averageOfPeriod', { name: periodAverage.periodName })}
          value={formatAverage(periodAverage.average, scale)}
          valueClassName="text-violet-300"
          sub={t('ui.gradedTasksCount', { count: periodAverage.gradedTaskCount })}
          sparklineData={sparklineData}
          accent="violet"
          mounted={mounted}
          delayMs={0}
        />
      )}

      {programAverage && (
        <StatCard
          icon={<GraduationCapIcon className="shrink-0" />}
          label={t('ui.cumulativeAverageOf', { name: activeProgram.name })}
          value={formatAverage(programAverage.average, scale)}
          valueClassName="text-white"
          sub={t('ui.gradedTasksAcrossPeriods', { count: programAverage.gradedTaskCount })}
          sparklineData={sparklineData}
          accent="indigo"
          mounted={mounted}
          delayMs={80}
        />
      )}
    </div>

    {comparison.length > 1 && (
      <div
        className={`relative overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 mb-4 shadow-xl transition-[opacity,translate] duration-[var(--duration-slow)] ease-smooth-out ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
        }`}
        style={{ transitionDelay: '160ms' }}
      >
        <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1 flex items-center gap-1.5">
          <TrendingUpIcon className="shrink-0" />
          {t('ui.periodComparison')}
        </p>
        <Suspense fallback={<Skeleton className="h-72 w-full" />}>
          <GpaTrendChart
            entries={comparison}
            scale={scale}
            cumulativeAverage={programAverage?.average ?? null}
          />
        </Suspense>
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
