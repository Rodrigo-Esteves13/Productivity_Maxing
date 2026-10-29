import { Link } from 'react-router-dom';
import { TrendingUpIcon } from '../UI/Icons';
import DashboardCard, { CardHeading } from '../UI/DashboardCard';
import ColorDot from '../UI/ColorDot';
import ProgressBar from '../UI/ProgressBar';
import BackfillStudyTime from './BackfillStudyTime';
import { useGradeProjection } from '../../hooks/useGradeProjection';
import { formatDayLabel, formatDuration } from '../../lib/timeFormat';
import type { GradeProjection, GradeProjectionTask } from '../../types/models';
import { useI18n } from '../../i18n/useI18n';
import { translateNow } from '../../i18n/translate';

const MAX_TASKS_SHOWN = 4;
// A partir daqui mais dados ja mexem pouco no resultado: deixa de se insistir.
const ENOUGH_SAMPLES_TO_STOP_ASKING = 20;

// Mensagem honesta quando nao ha projecao: nao se mostra um numero inventado.
function noProjectionMessage(projection: GradeProjection): string {
  if (projection.status === 'no_clear_link') {
    return translateNow('ui.projectionNoClearLink');
  }
  return translateNow('ui.projectionNeedsSamples', { needed: projection.minSamplesNeeded, have: projection.trainingSamples });
}

function basisText(task: GradeProjectionTask): string {
  return translateNow(task.basis === 'course' ? 'ui.projectionBasisCourse' : 'ui.projectionBasisAll', { count: task.sampleSize });
}

// So fala do alvo quando a projecao fica abaixo dele: diz quanto estudo falta.
function targetAdvice(task: GradeProjectionTask): string | null {
  if (task.targetGrade === null || task.projectedGrade === null) return null;
  if (task.projectedGrade >= task.targetGrade) return null;
  if (task.minutesForTarget === null) {
    return translateNow('ui.projectionNoRealisticStudy', { grade: gradeText(task.targetGrade) });
  }
  const extra = task.minutesForTarget - task.minutesBasis;
  if (extra <= 0) return null;
  return translateNow('ui.projectionToReach', { grade: gradeText(task.targetGrade), total: formatDuration(task.minutesForTarget), extra: formatDuration(extra) });
}

function gradeText(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function TaskLine({ task }: { task: GradeProjectionTask }) {
  const { t } = useI18n();
  const hasProjection = task.projectedGrade !== null && task.rangeGrade !== null;
  const belowTarget =
    hasProjection && task.targetGrade !== null && task.projectedGrade! < task.targetGrade;

  return (
    <li>
      <div className="flex items-baseline justify-between gap-3">
        <p className="flex min-w-0 items-center gap-2 text-sm text-neutral-200">
          <ColorDot size="xs" color={task.areaColorHex} />
          <span className="truncate">{task.title}</span>
        </p>
        <p className="shrink-0 text-xs text-neutral-500">{formatDayLabel(task.deadline)}</p>
      </div>

      {hasProjection ? (
        <>
          <p className="mt-0.5 pl-4 text-sm text-white">
            ~{gradeText(task.projectedGrade!)}
            <span className="text-xs text-neutral-500">
              {t('ui.likelyToOfWithOf', { low: gradeText(task.rangeGrade!.low), high: gradeText(task.rangeGrade!.high), gradeMax: task.gradeMax, minutesBasis: formatDuration(task.minutesBasis) })}</span>
          </p>
          {task.gainPerExtraHour !== null && task.gainPerExtraHour > 0 && (
            <p className={`mt-0.5 pl-4 text-xs ${belowTarget ? 'text-amber-400' : 'text-violet-300'}`}>
              {belowTarget && task.targetGrade !== null && `${t('ui.belowYourTarget', { grade: gradeText(task.targetGrade) })} `}
              {t('ui.eachExtraHourAdds', { points: gradeText(task.gainPerExtraHour) })}
            </p>
          )}
          {targetAdvice(task) && <p className="mt-0.5 pl-4 text-xs text-amber-300">{targetAdvice(task)}</p>}
          <p className="mt-0.5 pl-4 text-[11px] text-neutral-500">{basisText(task)}</p>
        </>
      ) : (
        <p className="mt-0.5 pl-4 text-xs text-neutral-500">
          {task.reason === 'no_clear_link' ? t('ui.noClearLinkBetweenStudy') : t('ui.notEnoughGradedHistoryYet')}
        </p>
      )}
    </li>
  );
}

// Nota prevista das proximas avaliacoes a partir de como o tempo de estudo
// se relacionou com as notas nas que ja fizeste. So mostra um numero
// quando essa relacao existe nos teus dados.
export default function GradeProjectionCard() {
  const { t } = useI18n();
  const { projection, isLoading, error, reload } = useGradeProjection();

  if (isLoading || error || !projection || projection.status === 'nothing_pending') return null;

  const shown = projection.tasks.slice(0, MAX_TASKS_SHOWN);
  const hidden = projection.tasks.length - shown.length;
  const { backfillCandidates } = projection;
  const shouldAskForHistory =
    backfillCandidates.length > 0 && projection.trainingSamples < ENOUGH_SAMPLES_TO_STOP_ASKING;
  const isReady = projection.status === 'ready';

  return (
    <DashboardCard>
      <CardHeading className="mb-3">
        <TrendingUpIcon className="shrink-0" />
        {t('ui.gradeProjection')}
      </CardHeading>

      {projection.status === 'ready' ? (
        <>
          <ul className="space-y-3">
            {shown.map((task) => (
              <TaskLine key={task.taskId} task={task} />
            ))}
          </ul>
          {hidden > 0 && <p className="mt-3 text-xs text-neutral-500">{t('ui.andMoreGradedTasks', { hidden: hidden })}</p>}
          <p className="mt-3 text-[11px] text-neutral-500">
            {t('ui.anEstimateFromYourOwn')}
          </p>
        </>
      ) : (
        <>
          <p className="text-sm text-neutral-400">{noProjectionMessage(projection)}</p>
          {/* Quanto falta, em vez de so "ainda nao": cada task avaliada com
              estudo registado aproxima a primeira previsao. */}
          {projection.status === 'not_enough_data' && (
            <div className="mt-3 space-y-1.5">
              <ProgressBar
                percent={(projection.trainingSamples / projection.minSamplesNeeded) * 100}
                label={t('ui.projectionProgress', { have: projection.trainingSamples, needed: projection.minSamplesNeeded })}
              />
              <p className="text-xs text-neutral-500">{t('ui.projectionAreaStudyCounts')}</p>
            </div>
          )}
        </>
      )}

      {shouldAskForHistory && (
        <details className="mt-3 rounded-lg border border-neutral-800 p-3" open={!isReady}>
          <summary className="cursor-pointer text-xs font-medium text-violet-300">
            {isReady
              ? t('ui.makeItMoreAccurateAdd')
              : t('ui.unlockThisNowHowLong')}
          </summary>
          <div className="mt-3">
            <BackfillStudyTime candidates={backfillCandidates} onSaved={reload} />
          </div>
        </details>
      )}

      <Link
        to="/schedule"
        className="mt-3 inline-block text-xs text-violet-400 underline decoration-dotted hover:text-violet-300"
      >
        {t('ui.openStudyPlan')}
      </Link>
    </DashboardCard>
  );
}
