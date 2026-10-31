import type { RatingCourseRow } from '../../types/models';
import { formatHours, formatNumber, formatPercent } from '../../lib/ratings';
import { RATING_MAX } from '../../lib/rating';
import ColorDot from '../UI/ColorDot';
import { useI18n } from '../../i18n/useI18n';

function useCells(row: RatingCourseRow) {
  const { t, lang } = useI18n();
  const dash = t('ratings.none');
  return {
    teacher: row.teacherName ?? dash,
    teacherRating: row.teacherRating === null ? dash : `${row.teacherRating}/${RATING_MAX}`,
    courseLiking: row.courseLiking === null ? dash : `${row.courseLiking}/${RATING_MAX}`,
    focus: row.avgFocus === null ? dash : formatNumber(row.avgFocus, lang, 1),
    hours: formatHours(row.studiedMinutes, lang),
    grade: row.gradeFraction === null ? dash : formatPercent(row.gradeFraction, lang),
  };
}

function MobileCard({ row }: { row: RatingCourseRow }) {
  const { t } = useI18n();
  const c = useCells(row);
  const items: [string, string][] = [
    [t('ratings.col.teacher'), c.teacher],
    [t('ratings.col.teacherRating'), c.teacherRating],
    [t('ratings.col.courseLiking'), c.courseLiking],
    [t('ratings.col.focus'), c.focus],
    [t('ratings.col.hours'), c.hours],
    [t('ratings.col.grade'), c.grade],
  ];
  return (
    <li className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
      <p className="mb-2 flex items-center gap-2 font-medium text-white">
        <ColorDot color={row.colorHex} />
        <span className="min-w-0 truncate">{row.areaName}</span>
      </p>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        {items.map(([label, value]) => (
          <div key={label}>
            <dt className="text-neutral-500">{label}</dt>
            <dd className="tabular-nums text-neutral-200">{value}</dd>
          </div>
        ))}
      </dl>
    </li>
  );
}

function TableRow({ row }: { row: RatingCourseRow }) {
  const c = useCells(row);
  return (
    <tr className="border-b border-neutral-800/60">
      <td className="py-2 pr-3 text-neutral-200">
        <span className="flex items-center gap-2">
          <ColorDot color={row.colorHex} />
          {row.areaName}
        </span>
      </td>
      <td className="py-2 pr-3 text-neutral-300">{c.teacher}</td>
      <td className="py-2 pr-3 text-right tabular-nums text-neutral-300">{c.teacherRating}</td>
      <td className="py-2 pr-3 text-right tabular-nums text-neutral-300">{c.courseLiking}</td>
      <td className="py-2 pr-3 text-right tabular-nums text-neutral-300">{c.focus}</td>
      <td className="py-2 pr-3 text-right tabular-nums text-neutral-300">{c.hours}</td>
      <td className="py-2 text-right font-medium tabular-nums text-white">{c.grade}</td>
    </tr>
  );
}

export default function CoursesTable({ courses }: { courses: RatingCourseRow[] }) {
  const { t } = useI18n();
  const headClass = 'py-2 pr-3 font-medium';
  return (
    <>
      <ul className="space-y-2 md:hidden">
        {courses.map((row) => (
          <MobileCard key={row.areaId} row={row} />
        ))}
      </ul>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-800 text-left text-neutral-400">
              <th className={headClass}>{t('ratings.col.course')}</th>
              <th className={headClass}>{t('ratings.col.teacher')}</th>
              <th className={`${headClass} text-right`}>{t('ratings.col.teacherRating')}</th>
              <th className={`${headClass} text-right`}>{t('ratings.col.courseLiking')}</th>
              <th className={`${headClass} text-right`}>{t('ratings.col.focus')}</th>
              <th className={`${headClass} text-right`}>{t('ratings.col.hours')}</th>
              <th className="py-2 text-right font-medium">{t('ratings.col.grade')}</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((row) => (
              <TableRow key={row.areaId} row={row} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
