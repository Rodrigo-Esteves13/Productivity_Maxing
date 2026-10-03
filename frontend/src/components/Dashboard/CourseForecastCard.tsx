import { Link } from 'react-router-dom';
import { BookOpenIcon } from '../UI/Icons';
import { useCourseForecast } from '../../hooks/useCourseForecast';
import { formatDayLabel, formatDuration } from '../../lib/timeFormat';
import type { CourseForecast } from '../../types/models';
import DashboardCard, { CardHeading } from '../UI/DashboardCard';
import ColorDot from '../UI/ColorDot';

function typicalText(course: CourseForecast): string {
  if (course.avgMinutesPerGradedTask !== null) {
    return `${formatDuration(course.avgMinutesPerGradedTask)} per graded task`;
  }
  if (course.avgMinutesPerCompletedTask !== null) {
    return `${formatDuration(course.avgMinutesPerCompletedTask)} per task`;
  }
  return 'No finished tasks yet';
}

// Dados reais (do teu histórico de sessões) sobre quanto tempo cada
// cadeira costuma pedir e quanto ainda falta, em vez de um palpite.
export default function CourseForecastCard() {
  const { courses, isLoading, error } = useCourseForecast();

  // Sem dados o cartão não ocupa espaço (um buraco no layout é pior).
  if (isLoading || error || courses.length === 0) return null;

  return (
    <DashboardCard>
      <CardHeading className="mb-3">
        <BookOpenIcon className="shrink-0" />
        Study time per course
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
                {formatDuration(course.studiedMinutes)} studied
              </p>
            </div>
            <p className="text-xs text-neutral-500 mt-0.5 pl-4">
              Typical: {typicalText(course)}
              {course.completedTasks > 0 && ` (from ${course.completedTasks} finished)`}
            </p>
            {course.pendingTasks > 0 && (
              <p className="text-xs text-violet-300 mt-0.5 pl-4">
                Still needed: {formatDuration(course.remainingMinutes)} across {course.pendingTasks}{' '}
                {course.pendingTasks === 1 ? 'task' : 'tasks'}
                {course.nextDeadline && `, next due ${formatDayLabel(course.nextDeadline)}`}
              </p>
            )}
          </li>
        ))}
      </ul>
      <Link
        to="/schedule"
        className="inline-block text-xs text-violet-400 hover:text-violet-300 underline decoration-dotted mt-3"
      >
        Open study plan
      </Link>
    </DashboardCard>
  );
}
