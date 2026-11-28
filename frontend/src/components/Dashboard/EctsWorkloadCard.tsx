import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { useAcademic } from '../../context/useAcademic';
import { useEctsHoursPref } from '../../hooks/useEctsHoursPref';
import { useEctsWorkload } from '../../hooks/useEctsWorkload';
import {
  barSegments,
  computeEctsWorkload,
  elapsedFraction,
  MAX_HOURS_PER_CREDIT,
  MIN_HOURS_PER_CREDIT,
} from '../../lib/ectsWorkload';
import type { ElapsedResult, WorkloadStatus } from '../../lib/ectsWorkload';
import { HourglassIcon } from '../UI/Icons';
import DashboardCard, { CardHeading } from '../UI/DashboardCard';
import ErrorState from '../UI/ErrorState';
import LegendItem from '../UI/LegendItem';
import LinesSkeleton from '../UI/LinesSkeleton';
import PrefetchLink from '../UI/PrefetchLink';
import { useI18n } from '../../i18n/useI18n';

// Horas reais (aulas dadas + sessoes de foco) por cadeira contra as horas
// esperadas ate hoje (creditos x horas por credito, escalado pela fracao
// decorrida do periodo). E uma estimativa de referencia, nao uma nota.

type Translate = ReturnType<typeof useI18n>['t'];

const STATUS_LABEL_KEY: Record<WorkloadStatus, string> = {
  below: 'ectsWorkload.statusBelow',
  onTrack: 'ectsWorkload.statusOnTrack',
  above: 'ectsWorkload.statusAbove',
  early: 'ectsWorkload.statusEarly',
};

// Sem verde: abaixo = ambar, dentro = neutro, acima = violeta, cedo = discreto.
const STATUS_CLASS: Record<WorkloadStatus, string> = {
  below: 'text-amber-400',
  onTrack: 'text-neutral-200',
  above: 'text-violet-300',
  early: 'text-neutral-400',
};

// Slider com area de toque grande: largura total no telemovel, thumb de 20px.
const SLIDER_CLASS = [
  'h-8 pointer-coarse:h-11 w-full sm:w-28 cursor-pointer appearance-none bg-transparent',
  'focus-visible:outline-2 focus-visible:outline-violet-500',
  '[&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-neutral-700',
  '[&::-webkit-slider-thumb]:-mt-[7px] [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-500',
  '[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-neutral-700',
  '[&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-violet-500',
].join(' ');

interface WorkloadLine {
  classHours: number;
  studyHours: number;
  realHours: number;
  expectedSoFarHours: number | null;
  status: WorkloadStatus | null;
}

function WorkloadBar({ line, label }: { line: WorkloadLine; label: string }) {
  // Escala por linha: o maior entre real e esperado enche a barra. Os segmentos
  // sao relativos a barra inteira (nao ao total real), sem escalar duas vezes.
  const { classPct, studyPct, expectedPct } = barSegments(line.classHours, line.studyHours, line.expectedSoFarHours);
  return (
    <div role="img" aria-label={label} className="relative h-2 rounded-full bg-neutral-800 overflow-hidden">
      <div className="flex h-full">
        <div className="h-full bg-violet-500" style={{ width: `${classPct}%` }} />
        <div className="h-full bg-violet-300" style={{ width: `${studyPct}%` }} />
      </div>
      {expectedPct !== null && (
        <div
          aria-hidden="true"
          className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-amber-400"
          style={{ left: `${expectedPct}%` }}
        />
      )}
    </div>
  );
}

function LineBody({
  line,
  fullHours,
  name,
  strong,
  fmt,
  t,
}: {
  line: WorkloadLine;
  fullHours: number;
  name: string;
  strong?: boolean;
  fmt: (hours: number) => string;
  t: Translate;
}) {
  const hours = (value: number) => t('ectsWorkload.hoursUnit', { value: fmt(value) });
  const summary =
    line.expectedSoFarHours === null
      ? t('ectsWorkload.rowReal', { real: hours(line.realHours) })
      : t('ectsWorkload.rowSummary', { real: hours(line.realHours), expected: hours(line.expectedSoFarHours) });
  const barLabel = `${name}: ${summary}`;
  return (
    <>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
        <span className={`min-w-0 max-w-full truncate text-sm ${strong ? 'font-semibold text-neutral-100' : 'text-neutral-200'}`} title={name}>
          {name}
        </span>
        {line.status && (
          <span className={`shrink-0 text-xs font-medium ${STATUS_CLASS[line.status]}`}>
            {t(STATUS_LABEL_KEY[line.status])}
          </span>
        )}
      </div>
      <WorkloadBar line={line} label={barLabel} />
      <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs tabular-nums text-neutral-400">
        <span>{summary}</span>
        <span>
          {t('ectsWorkload.legendClasses')} {hours(line.classHours)}
        </span>
        <span>
          {t('ectsWorkload.legendStudy')} {hours(line.studyHours)}
        </span>
        <span>{t('ectsWorkload.expectedFull', { value: hours(fullHours) })}</span>
      </p>
    </>
  );
}

function CardShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  return (
    <DashboardCard>
      <CardHeading className="mb-1">
        <HourglassIcon className="shrink-0" />
        {t('widget.ectsWorkload')}
      </CardHeading>
      <p className="mb-3 text-xs text-neutral-400">{t('ectsWorkload.description')}</p>
      {children}
    </DashboardCard>
  );
}

function EctsWorkloadBody() {
  const { t, lang } = useI18n();
  const { activePeriod } = useAcademic();
  const { data, isLoading, hasError, retry } = useEctsWorkload();
  const { hoursPerCredit, setHours, resetHours, isDefault } = useEctsHoursPref();

  const elapsed = useMemo<ElapsedResult>(
    () =>
      activePeriod
        ? elapsedFraction(activePeriod.startDate, activePeriod.endDate, Date.now())
        : { kind: 'invalid' },
    [activePeriod],
  );
  const fraction = elapsed.kind === 'ok' ? elapsed.fraction : null;

  const result = useMemo(
    () => computeEctsWorkload(data?.courses ?? [], hoursPerCredit, fraction),
    [data, hoursPerCredit, fraction],
  );

  const formatter = useMemo(
    () => new Intl.NumberFormat(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    [lang],
  );
  const fmt = (hours: number) => formatter.format(hours);

  if (elapsed.kind === 'notStarted' || elapsed.kind === 'invalid') {
    return (
      <CardShell>
        <p className="text-sm text-neutral-400" role="note">
          {t(elapsed.kind === 'notStarted' ? 'ectsWorkload.notStarted' : 'ectsWorkload.invalidPeriod')}
        </p>
      </CardShell>
    );
  }
  if (isLoading) {
    return (
      <CardShell>
        <LinesSkeleton lines={3} />
      </CardShell>
    );
  }
  if (hasError || !data) {
    return (
      <CardShell>
        <ErrorState message={t('ectsWorkload.error')} onRetry={retry} />
      </CardShell>
    );
  }
  // Sem cadeiras com creditos nem disciplinas por associar: nada a mostrar
  // (como o cartao de creditos acumulados), em vez de um CTA permanente.
  if (result.rows.length === 0 && data.unlinkedSubjects.length === 0) return null;
  if (result.rows.length === 0) {
    return (
      <CardShell>
        <p className="text-sm text-neutral-400">{t('ectsWorkload.empty')}</p>
        <PrefetchLink
          to="/areas"
          className="pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center mt-2 inline-block text-xs text-violet-400 underline transition-colors hover:text-violet-300 focus-visible:outline-2 focus-visible:outline-violet-500"
        >
          {t('ectsWorkload.emptyLink')}
        </PrefetchLink>
      </CardShell>
    );
  }

  const unlinked = data.unlinkedSubjects.length;
  return (
    <CardShell>
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-400">
        <label htmlFor="ects-hours-per-credit">{t('ectsWorkload.hoursPerCredit')}</label>
        <input
          id="ects-hours-per-credit"
          type="range"
          min={MIN_HOURS_PER_CREDIT}
          max={MAX_HOURS_PER_CREDIT}
          step={1}
          value={hoursPerCredit}
          onChange={(e) => setHours(Number(e.target.value))}
          className={SLIDER_CLASS}
        />
        <span className="tabular-nums text-neutral-200">{t('ectsWorkload.hoursUnit', { value: hoursPerCredit })}</span>
        {!isDefault && (
          <button
            type="button"
            onClick={resetHours}
            className="pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center text-violet-400 underline decoration-dotted hover:text-violet-300 focus-visible:outline-2 focus-visible:outline-violet-500"
          >
            {t('ectsWorkload.reset')}
          </button>
        )}
      </div>
      {fraction === null && (
        <p className="mb-3 text-xs text-neutral-400" role="note">
          {t('ectsWorkload.noEndNote')}
        </p>
      )}
      <ul className="space-y-3">
        {result.rows.map((row) => (
          <li key={row.areaId} data-testid="ects-workload-row">
            <LineBody line={row} fullHours={row.expectedFullHours} name={row.name} fmt={fmt} t={t} />
          </li>
        ))}
      </ul>
      <div className="mt-3 border-t border-neutral-800 pt-3" data-testid="ects-workload-total">
        <LineBody
          line={result.totals}
          fullHours={result.totals.expectedFullHours}
          name={t('ectsWorkload.total')}
          strong
          fmt={fmt}
          t={t}
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-400">
        <LegendItem dotClassName="bg-violet-500">{t('ectsWorkload.legendClasses')}</LegendItem>
        <LegendItem dotClassName="bg-violet-300">{t('ectsWorkload.legendStudy')}</LegendItem>
        <LegendItem dotClassName="bg-amber-400">{t('ectsWorkload.legendExpected')}</LegendItem>
      </div>
      {unlinked > 0 && (
        <p className="mt-3 text-xs text-neutral-400">
          {t('ectsWorkload.unlinked', { count: unlinked })}{' '}
          <PrefetchLink
            to="/notebook"
            className="pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center text-violet-400 underline decoration-dotted transition-colors hover:text-violet-300 focus-visible:outline-2 focus-visible:outline-violet-500"
          >
            {t('ectsWorkload.linkHint')}
          </PrefetchLink>
        </p>
      )}
      <p className="mt-3 text-xs text-neutral-500">
        {t('ectsWorkload.estimateNote')} {t('ectsWorkload.overlapNote')}
      </p>
    </CardShell>
  );
}

// Sem periodo concreto (vista "todos os periodos/programas") nao ha
// escala temporal nem pedido: o cartao nao aparece.
export default function EctsWorkloadCard() {
  const { activePeriod, isViewingAllPeriods, isViewingAllPrograms } = useAcademic();
  if (isViewingAllPeriods || isViewingAllPrograms || !activePeriod) return null;
  return <EctsWorkloadBody />;
}
