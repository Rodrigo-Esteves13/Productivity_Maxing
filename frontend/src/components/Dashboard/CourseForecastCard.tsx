import { Link } from 'react-router-dom';
import { BookOpenIcon } from '../UI/Icons';
import { useCourseForecast } from '../../hooks/useCourseForecast';
import { formatDayLabel, formatDuration } from '../../lib/timeFormat';
import type { CourseForecast } from '../../types/models';
import DashboardCard, { CardHeading } from '../UI/DashboardCard';
import ColorDot from '../UI/ColorDot';
import { useI18n } from '../../i18n/useI18n';
import { translateNow } from '../../i18n/translate';

function typicalText(course: CourseForecast): string {
  if (course.avgMinutesPerGradedTask !== null) {
    return translateNow('ui.perGradedTask', { duration: formatDuration(course.avgMinutesPerGradedTask) });
  }
  if (course.avgMinutesPerCompletedTask !== null) {
    return translateNow('ui.perTask', { duration: formatDuration(course.avgMinutesPerCompletedTask) });
  }
  return translateNow('ui.noFinishedTasksYet');
}

// Dados reais (do teu histórico de sessões) sobre quanto tempo cada
// cadeira costuma pedir e quanto ainda falta, em vez de um palpite.
export default function CourseForecastCard() {
  const { t } = useI18n();
  const { courses, isLoading, error } = useCourseForecast();

  // Sem dados o cartão não ocupa espaço (um buraco no layout é pior).
  if (isLoading || error || courses.length === 0) return null;

  return (
    <DashboardCard>
      <CardHeading className="mb-3">
        <BookOpenIcon className="shrink-0" />
        {t('ui.studyTimePerCourse')}
      </CardHeading>
      <ul className="space-y-3">
        {courses.map((course) => (
          <li key={course.areaId}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm text-neutral-200 flex items-center gap-2 min-w-0">
                <ColorDot size="xs" color={course.areaColorHex} />
                <span className="truncate">{course.areaName}</span>
              </p>
              <p className="text-xs text-neutral-500 shrink-0">
                {t('ui.studied', { studiedMinutes: formatDuration(course.studiedMinutes) })}</p>
            </div>
            <p className="text-xs text-neutral-500 mt-0.5 pl-4">
              {t('ui.forecastTypical', { value: typicalText(course) })}
              {course.completedTasks > 0 && ` ${t('ui.forecastFromFinished', { count: course.completedTasks })}`}
            </p>
            {course.pendingTasks > 0 && (
              <p className="text-xs text-violet-300 mt-0.5 pl-4">
                {t(course.pendingTasks === 1 ? 'ui.forecastStillNeededOne' : 'ui.forecastStillNeededMany', {
                  duration: formatDuration(course.remainingMinutes),
                  count: course.pendingTasks,
                })}
                {course.nextDeadline && t('ui.forecastNextDue', { day: formatDayLabel(course.nextDeadline) })}
              </p>
            )}
          </li>
        ))}
      </ul>
      <Link
        to="/schedule"
        className="inline-block text-xs text-violet-400 hover:text-violet-300 underline decoration-dotted mt-3"
      >
        {t('ui.openStudyPlan')}
      </Link>
    </DashboardCard>
  );
}
