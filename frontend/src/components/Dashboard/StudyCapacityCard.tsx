import { Link } from 'react-router-dom';
import { useStudyPlan } from '../../hooks/useStudyPlan';
import { AlertTriangleIcon, ClockIcon } from '../UI/Icons';
import { formatDuration } from '../../lib/timeFormat';
import { BANNER_BY_STATUS } from '../Study/plan/planCopy';

const WINDOW_DAYS = 7;

// Resumo do plano de estudo no Dashboard: diz, num relance, se a carga
// dos próximos 7 dias cabe no tempo livre (aulas, trabalho, deslocações e
// horas de sono já descontadas) ou se é preciso overtime. O detalhe por
// dia e por task vive na página Schedule.
export default function StudyCapacityCard() {
  const { plan, isLoading, error } = useStudyPlan(WINDOW_DAYS);

  // Sem dados (a carregar, erro ou nada por fazer) o cartão não ocupa
  // espaço: um buraco no layout é pior do que não mostrar nada.
  if (isLoading || error || !plan || plan.summary.status === 'no_work') return null;

  const { summary, dailyLimitMinutes } = plan;
  const copy = BANNER_BY_STATUS[summary.status];
  const needsAttention = summary.status === 'overtime' || summary.status === 'short';
  const Icon = needsAttention ? AlertTriangleIcon : ClockIcon;
  const fillPct = Math.min(
    100,
    Math.round((summary.plannedMinutes / Math.max(1, summary.neededMinutes)) * 100),
  );

  return (
    <div className={`border rounded-xl p-4 shadow-xl bg-neutral-900/50 ${copy.containerClass}`}>
      <p className="text-xs uppercase tracking-wide text-neutral-500 mb-2 flex items-center gap-1.5">
        <Icon className="shrink-0" />
        Study capacity, next {WINDOW_DAYS} days
      </p>
      <p className={`text-lg font-semibold ${copy.titleClass}`}>{copy.title}</p>
      <p className="text-sm text-neutral-300 mt-1">
        {copy.body({
          neededMinutes: summary.neededMinutes,
          overtimeMinutes: summary.overtimeMinutes,
          shortfallMinutes: summary.shortfallMinutes,
          dailyLimitMinutes,
        })}
      </p>
      <div
        className="mt-3 h-1.5 rounded-full bg-neutral-800 overflow-hidden"
        role="progressbar"
        aria-valuenow={fillPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Share of needed study time that fits in your week"
      >
        <div
          className={`h-full ${needsAttention ? 'bg-amber-500' : 'bg-violet-500'}`}
          style={{ width: `${fillPct}%` }}
        />
      </div>
      <p className="text-xs text-neutral-500 mt-2">
        {formatDuration(summary.plannedMinutes)} of {formatDuration(summary.neededMinutes)} scheduled
      </p>
      <Link
        to="/schedule"
        className="inline-block text-xs text-violet-400 hover:text-violet-300 underline decoration-dotted mt-2"
      >
        Open study plan
      </Link>
    </div>
  );
}
