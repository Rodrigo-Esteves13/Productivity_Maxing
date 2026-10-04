import { Link } from 'react-router-dom';
import { TrendingUpIcon } from '../UI/Icons';
import DashboardCard, { CardHeading } from '../UI/DashboardCard';
import ColorDot from '../UI/ColorDot';
import BackfillStudyTime from './BackfillStudyTime';
import { useGradeProjection } from '../../hooks/useGradeProjection';
import { formatDayLabel, formatDuration } from '../../lib/timeFormat';
import type { GradeProjection, GradeProjectionTask } from '../../types/models';

const MAX_TASKS_SHOWN = 4;
// A partir daqui mais dados ja mexem pouco no resultado: deixa de se insistir.
const ENOUGH_SAMPLES_TO_STOP_ASKING = 20;

// Mensagem honesta quando nao ha projecao: nao se mostra um numero inventado.
function noProjectionMessage(projection: GradeProjection): string {
  if (projection.status === 'no_clear_link') {
    return 'So far your grades do not follow how long you studied, so a projection would just be a guess. Keep logging sessions and grades.';
  }
  return `Needs ${projection.minSamplesNeeded} finished graded tasks with study time logged. You have ${projection.trainingSamples}.`;
}

function basisText(task: GradeProjectionTask): string {
  const scope = task.basis === 'course' ? 'this course' : 'all your courses';
  return `Based on ${task.sampleSize} graded tasks in ${scope}`;
}

// So fala do alvo quando a projecao fica abaixo dele: diz quanto estudo falta.
function targetAdvice(task: GradeProjectionTask): string | null {
  if (task.targetGrade === null || task.projectedGrade === null) return null;
  if (task.projectedGrade >= task.targetGrade) return null;
  if (task.minutesForTarget === null) {
    return `Your data does not show a realistic amount of study that reaches ${gradeText(task.targetGrade)}.`;
  }
  const extra = task.minutesForTarget - task.minutesBasis;
  if (extra <= 0) return null;
  return `To reach ${gradeText(task.targetGrade)}, about ${formatDuration(task.minutesForTarget)} in total (${formatDuration(extra)} more).`;
}

function gradeText(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function TaskLine({ task }: { task: GradeProjectionTask }) {
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
              {' '}
              (likely {gradeText(task.rangeGrade!.low)} to {gradeText(task.rangeGrade!.high)} of {task.gradeMax}) with{' '}
              {formatDuration(task.minutesBasis)} of study
            </span>
          </p>
          {task.gainPerExtraHour !== null && task.gainPerExtraHour > 0 && (
            <p className={`mt-0.5 pl-4 text-xs ${belowTarget ? 'text-amber-400' : 'text-violet-300'}`}>
              {belowTarget && task.targetGrade !== null && `Below your target of ${gradeText(task.targetGrade)}. `}
              Each extra hour adds about {gradeText(task.gainPerExtraHour)} points.
            </p>
          )}
          {targetAdvice(task) && <p className="mt-0.5 pl-4 text-xs text-amber-300">{targetAdvice(task)}</p>}
          <p className="mt-0.5 pl-4 text-[11px] text-neutral-600">{basisText(task)}</p>
        </>
      ) : (
        <p className="mt-0.5 pl-4 text-xs text-neutral-500">
          {task.reason === 'no_clear_link' ? 'No clear link between study time and grades here yet.' : 'Not enough graded history yet.'}
        </p>
      )}
    </li>
  );
}

// Nota prevista das proximas avaliacoes a partir de como o tempo de estudo
// se relacionou com as notas nas que ja fizeste. So mostra um numero
// quando essa relacao existe nos teus dados.
export default function GradeProjectionCard() {
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
        Grade projection
      </CardHeading>

      {projection.status === 'ready' ? (
        <>
          <ul className="space-y-3">
            {shown.map((task) => (
              <TaskLine key={task.taskId} task={task} />
            ))}
          </ul>
          {hidden > 0 && <p className="mt-3 text-xs text-neutral-500">and {hidden} more graded tasks</p>}
          <p className="mt-3 text-[11px] text-neutral-600">
            An estimate from your own past results, not a promise. The range shows where about 8 in 10 of your grades fell.
          </p>
        </>
      ) : (
        <p className="text-sm text-neutral-400">{noProjectionMessage(projection)}</p>
      )}

      {shouldAskForHistory && (
        <details className="mt-3 rounded-lg border border-neutral-800 p-3" open={!isReady}>
          <summary className="cursor-pointer text-xs font-medium text-violet-300">
            {isReady
              ? 'Make it more accurate: add study time for past evaluations'
              : 'Unlock this now: how long did you study for past evaluations?'}
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
        Open study plan
      </Link>
    </DashboardCard>
  );
}
