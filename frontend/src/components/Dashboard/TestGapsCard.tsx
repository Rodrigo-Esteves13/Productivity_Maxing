import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Area, Task } from '../../types/models';
import DashboardCard, { CardHeading } from '../UI/DashboardCard';
import ToggleChip from '../UI/ToggleChip';
import { AlertTriangleIcon, HourglassIcon } from '../UI/Icons';
import { useAreaLookup } from '../../hooks/useAreaLookup';
import { useI18n } from '../../i18n/useI18n';
import { lisbonTodayKey } from '../../lib/dateKey';
import { buildDeadlineGaps, type GapMode, type GapTone, type StopKind } from '../../lib/testGaps';

interface TestGapsCardProps {
  tasks: Task[];
  areas: Area[];
}

const TONE: Record<GapTone, { bar: string; text: string }> = {
  tight: { bar: 'bg-red-400', text: 'text-red-300' },
  short: { bar: 'bg-amber-400', text: 'text-amber-300' },
  roomy: { bar: 'bg-violet-400', text: 'text-violet-300' },
};

const MODES: { mode: GapMode; labelKey: string }[] = [
  { mode: 'all', labelKey: 'testGaps.mode.all' },
  { mode: 'tests', labelKey: 'testGaps.mode.tests' },
  { mode: 'work', labelKey: 'testGaps.mode.work' },
];

const KIND_LABEL: Record<StopKind, string> = {
  test: 'testGaps.kind.test',
  due: 'testGaps.kind.due',
  handIn: 'testGaps.kind.handIn',
  presentation: 'testGaps.kind.presentation',
};

// A barra mais curta continua visivel (um dia de folga nao pode desaparecer).
const MIN_BAR_PCT = 6;
// Fechado mostra so os proximos; "Show all" abre a fila toda.
const COLLAPSED_STOPS = 5;
const MODE_STORAGE_KEY = 'pmaxing:test-gaps-mode';

// Vista escolhida, lembrada neste browser (so conveniencia: sem storage
// volta a hibrida).
function readStoredMode(): GapMode {
  try {
    const stored = localStorage.getItem(MODE_STORAGE_KEY);
    return MODES.some((m) => m.mode === stored) ? (stored as GapMode) : 'all';
  } catch {
    return 'all';
  }
}

// Quanto tempo ha entre cada avaliacao e a seguinte, em fila desde hoje: a
// linha do lado mostra a folga de cada uma (comprimento = dias, cor = quao
// apertado), e o dia ao lado e a contagem a partir de hoje. Por omissao
// junta testes e trabalhos; da para ver so uns ou so outros.
export default function TestGapsCard({ tasks, areas }: TestGapsCardProps) {
  const { t, lang } = useI18n();
  const areaById = useAreaLookup(areas);
  const [mode, setMode] = useState<GapMode>(readStoredMode);
  const [expanded, setExpanded] = useState(false);
  const today = lisbonTodayKey();
  const hasAny = useMemo(() => buildDeadlineGaps(tasks, today, 'all').stops.length > 0, [tasks, today]);
  const { stops, tightest, averageGap } = useMemo(() => buildDeadlineGaps(tasks, today, mode), [tasks, today, mode]);

  if (!hasAny) return null;

  const chooseMode = (next: GapMode) => {
    setMode(next);
    setExpanded(false);
    try {
      localStorage.setItem(MODE_STORAGE_KEY, next);
    } catch {
      // Sem storage a escolha so dura ate recarregar.
    }
  };

  const visible = expanded ? stops : stops.slice(0, COLLAPSED_STOPS);
  const hiddenCount = stops.length - visible.length;
  const maxGap = Math.max(...visible.map((s) => s.gap), 1);
  const showKind = mode !== 'tests';
  const dayLabel = (key: string) =>
    new Date(`${key}T00:00:00Z`).toLocaleDateString(lang, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    });
  const gapText = (days: number) =>
    days === 0 ? t('testGaps.sameDay') : days === 1 ? t('testGaps.oneDay') : t('testGaps.days', { count: days });

  return (
    <DashboardCard>
      <CardHeading className="mb-2">
        <HourglassIcon className="shrink-0" />
        {t('testGaps.title')}
      </CardHeading>
      <div role="group" aria-label={t('testGaps.modeLabel')} className="mb-3 flex flex-wrap gap-1">
        {MODES.map(({ mode: option, labelKey }) => (
          <ToggleChip key={option} size="sm" pressed={mode === option} onClick={() => chooseMode(option)}>
            {t(labelKey)}
          </ToggleChip>
        ))}
      </div>

      {stops.length === 0 ? (
        <p className="text-sm text-neutral-400">{t(mode === 'tests' ? 'testGaps.emptyTests' : 'testGaps.emptyWork')}</p>
      ) : (
        <>
          {averageGap !== null && (
            <div className="mb-1 flex items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums text-violet-400">{averageGap}</span>
              <span className="text-xs text-neutral-400">
                {t(mode === 'tests' ? 'testGaps.average' : 'testGaps.averageDeadlines')}
              </span>
            </div>
          )}
          {tightest && tightest.tone === 'tight' && (
            <p className="mb-3 flex items-start gap-1.5 text-xs text-red-300">
              <AlertTriangleIcon className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {t('testGaps.tightest', { gap: gapText(tightest.gap), title: tightest.task.title })}
            </p>
          )}

          <ol className="mt-3 text-sm" aria-label={t('testGaps.listLabel')}>
            <li className="grid grid-cols-[1rem_1fr] items-center gap-x-3">
              <span aria-hidden="true" className="mx-auto h-2.5 w-2.5 rounded-full border-2 border-neutral-500" />
              <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">{t('ui.today')}</span>
            </li>
            {visible.map((stop) => {
              const area = areaById.get(stop.task.areaId);
              // Entrega -> apresentacao da mesma task: troco neutro, nao e aperto.
              const tone = stop.followsOwnHandIn ? { bar: 'bg-neutral-600', text: 'text-neutral-400' } : TONE[stop.tone];
              const width = Math.max(MIN_BAR_PCT, Math.round((stop.gap / maxGap) * 100));
              return (
                <li key={stop.id}>
                  {/* Troco entre o ponto anterior e este: a folga. */}
                  <div className="grid grid-cols-[1rem_1fr] gap-x-3">
                    <span aria-hidden="true" className="mx-auto w-px bg-neutral-700" />
                    <div className="flex items-center gap-2 py-2">
                      <span className={`w-16 shrink-0 text-xs tabular-nums ${tone.text}`}>+{gapText(stop.gap)}</span>
                      <span aria-hidden="true" className="h-1.5 flex-1 rounded-full bg-neutral-800">
                        <span className={`block h-full rounded-full ${tone.bar}`} style={{ width: `${width}%` }} />
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-[1rem_1fr] items-start gap-x-3">
                    <span
                      aria-hidden="true"
                      className={`mx-auto mt-1.5 h-2.5 w-2.5 ring-2 ring-neutral-900 ${
                        stop.kind === 'test' ? 'rounded-full' : 'rounded-sm'
                      }`}
                      style={{ backgroundColor: area?.colorHex ?? 'var(--color-violet-400)' }}
                    />
                    <Link
                      to={`/tasks?open=${encodeURIComponent(stop.task.id)}`}
                      className="group flex min-w-0 items-start justify-between gap-3 rounded-md -mx-1 px-1 py-0.5 transition-colors hover:bg-neutral-800/60"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-neutral-100 group-hover:text-white">
                          {stop.task.title}
                        </span>
                        <span className="block truncate text-xs text-neutral-400">
                          {showKind && <span className="text-neutral-300">{t(KIND_LABEL[stop.kind])}</span>}
                          {showKind && area && ' · '}
                          {area?.name}
                        </span>
                      </span>
                      <span className="shrink-0 text-right text-xs tabular-nums">
                        <span className="block text-neutral-300">{dayLabel(stop.dayKey)}</span>
                        <span className="block text-neutral-500">{t('testGaps.dayN', { count: stop.fromToday })}</span>
                      </span>
                    </Link>
                  </div>
                </li>
              );
            })}
          </ol>

          {stops.length > COLLAPSED_STOPS && (
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded((open) => !open)}
              className="mt-3 text-xs font-medium text-violet-400 hover:text-violet-300"
            >
              {expanded ? t('testGaps.showLess') : t('testGaps.showAll', { count: hiddenCount })}
            </button>
          )}
        </>
      )}
    </DashboardCard>
  );
}
