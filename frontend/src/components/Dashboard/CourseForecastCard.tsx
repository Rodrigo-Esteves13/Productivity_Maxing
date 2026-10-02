import { Link } from 'react-router-dom';
import { BookOpenIcon } from '../UI/Icons';
import { useCourseForecast } from '../../hooks/useCourseForecast';
import { formatDayLabel, formatDuration } from '../../lib/timeFormat';
import type { CourseForecast } from '../../types/models';

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
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 shadow-xl">
      <p className="text-xs uppercase tracking-wide text-neutral-500 mb-3 flex items-center gap-1.5">
        <BookOpenIcon className="shrink-0" />
        Study time per course
      </p>
      <ul className="space-y-3">
        {courses.map((course) => (
          <li key={course.areaId}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm text-neutral-200 flex items-center gap-2 min-w-0">
                <span
                  className="inline-block w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: course.areaColorHex }}
                />
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
    </div>
  );
}
