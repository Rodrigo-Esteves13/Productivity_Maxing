import { TargetIcon } from '../UI/Icons';
import DashboardCard, { CardHeading } from '../UI/DashboardCard';
import ColorDot from '../UI/ColorDot';
import { usePlanScenario } from '../../hooks/usePlanScenario';
import { useI18n } from '../../i18n/useI18n';
import type { PlanScenarioCourse, PlanScenarioFill } from '../../types/models';

function gradeText(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

const FILL_SOURCE_KEY: Record<PlanScenarioFill['source'], string> = {
  course_median: 'planScenario.fill.course',
  period_median: 'planScenario.fill.period',
};

function CourseRow({ course, passThreshold }: { course: PlanScenarioCourse; passThreshold: number }) {
  const { t } = useI18n();
  const plan = course.planFinal;
  const passes = plan !== null && plan >= passThreshold;
  return (
    <li className="text-sm">
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2 text-neutral-200">
          <ColorDot size="xs" color={course.areaColorHex} />
          <span className="truncate">{course.areaName}</span>
        </span>
        {/* A cor sozinha nao chega: no Sunset com daltonismo o acento (ambar)
            e o vermelho (laranja) ficam parecidos. Abaixo da nota de passagem
            leva tambem uma marca em texto. */}
        <span className={`shrink-0 font-semibold tabular-nums ${plan === null ? 'text-neutral-500' : passes ? 'text-violet-300' : 'text-red-300'}`}>
          {plan === null ? t('common.na') : gradeText(plan)}
          {plan !== null && !passes && (
            <span className="ml-1.5 text-xs font-medium">{t('planScenario.belowPass')}</span>
          )}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-neutral-400">
        {course.projectedFinal !== null && course.delta !== null
          ? t('planScenario.vsProjection', {
              projected: gradeText(course.projectedFinal),
              delta: `${course.delta >= 0 ? '+' : ''}${gradeText(course.delta)}`,
            })
          : t('planScenario.noProjection')}
        {course.currentAverage !== null && ` · ${t('planScenario.soFar', { average: gradeText(course.currentAverage) })}`}
      </p>
      {course.fills.length > 0 && (
        <p className="mt-0.5 text-xs text-neutral-500">
          {course.fills
            .map((fill) =>
              t(FILL_SOURCE_KEY[fill.source], {
                label: fill.label,
                grade: gradeText(fill.grade),
                weight: gradeText(fill.weightPercentage),
              }),
            )
            .join(' ')}
        </p>
      )}
      {course.missingWeight > 0 && (
        <p className="mt-0.5 text-xs text-amber-300/80">
          {t('planScenario.missingWeight', { weight: gradeText(course.missingWeight) })}
        </p>
      )}
    </li>
  );
}

// "If all goes according to plan": nota final de cada cadeira se tirares o
// alvo em tudo o que falta e cumprires o plano, ao lado da projecao atual.
// As regras vivem no backend (plan-scenario.util.ts). Escondido enquanto
// carrega e sem cadeiras avaliadas, como os outros cartoes de previsao.
export default function PlanScenarioCard() {
  const { t } = useI18n();
  const { scenario, isLoading, error, reload } = usePlanScenario();
  if (isLoading) return null;

  if (error || !scenario) {
    return (
      <DashboardCard>
        <CardHeading className="mb-2">
          <TargetIcon className="shrink-0" />
          {t('widget.planScenario')}
        </CardHeading>
        <p className="text-sm text-neutral-400">
          {t('planScenario.loadError')}{' '}
          <button type="button" onClick={reload} className="text-violet-400 underline underline-offset-2 hover:text-violet-300">
            {t('common.tryAgain')}
          </button>
        </p>
      </DashboardCard>
    );
  }
  if (scenario.courses.length === 0) return null;

  return (
    <DashboardCard>
      <CardHeading className="mb-2">
        <TargetIcon className="shrink-0" />
        {t('widget.planScenario')}
      </CardHeading>
      <p className="mb-3 text-xs text-neutral-400">{t('planScenario.help')}</p>
      <ul className="space-y-3">
        {scenario.courses.map((course) => (
          <CourseRow key={course.areaId} course={course} passThreshold={scenario.passThreshold} />
        ))}
      </ul>
    </DashboardCard>
  );
}
