import { Link } from 'react-router-dom';
import { useStudyPlan } from '../../hooks/useStudyPlan';
import { AlertTriangleIcon, ClockIcon } from '../UI/Icons';
import { formatDuration } from '../../lib/timeFormat';
import { BANNER_BY_STATUS } from '../Study/plan/planCopy';
import ProgressBar from '../UI/ProgressBar';
import { CardHeading } from '../UI/DashboardCard';

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
      <CardHeading className="mb-2">
        <Icon className="shrink-0" />
        Study capacity, next {WINDOW_DAYS} days
      </CardHeading>
      <p className={`text-lg font-semibold ${copy.titleClass}`}>{copy.title}</p>
      <p className="text-sm text-neutral-300 mt-1">
        {copy.body({
          neededMinutes: summary.neededMinutes,
          overtimeMinutes: summary.overtimeMinutes,
          shortfallMinutes: summary.shortfallMinutes,
          dailyLimitMinutes,
        })}
      </p>
      <ProgressBar
        className="mt-3"
        percent={fillPct}
        fillClassName={needsAttention ? 'bg-amber-500' : 'bg-violet-500'}
        label="Share of needed study time that fits in your week"
      />
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
