import { Link } from 'react-router-dom';
import Card from '../UI/Card';
import ColorDot from '../UI/ColorDot';
import LinesSkeleton from '../UI/LinesSkeleton';
import { ClockIcon } from '../UI/Icons';
import { useStudyVsClass } from '../../hooks/useStudyVsClass';
import { formatDuration } from '../../lib/timeFormat';
import { useI18n } from '../../i18n/useI18n';

interface StudyVsClassCardProps {
  refreshKey: number;
}

// Horas de estudo por cadeira vs horas de aula ja dadas no periodo ativo.
// Sem aulas nem sessoes por cadeira o cartao nao aparece.
export default function StudyVsClassCard({ refreshKey }: StudyVsClassCardProps) {
  const { t } = useI18n();
  const { data, isLoading, hasError } = useStudyVsClass(refreshKey);
  const rows = data?.rows ?? [];
  const unlinked = data?.unlinkedSubjects ?? [];
  if (!isLoading && !hasError && rows.length === 0 && unlinked.length === 0) return null;

  return (
    <Card>
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-violet-500/10">
          <ClockIcon className="text-violet-400" width={18} height={18} />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-white">{t('studyVsClass.title')}</h2>
          <p className="mt-0.5 text-sm text-neutral-400">{t('studyVsClass.description')}</p>
        </div>
      </div>
      {isLoading ? (
        <LinesSkeleton lines={3} />
      ) : hasError ? (
        <p className="text-sm text-red-400">{t('studyVsClass.loadFailed')}</p>
      ) : (
        <>
          {rows.length > 0 && (
            <ul className="@container divide-y divide-neutral-800">
              {rows.map((row) => (
                <li
                  key={row.areaId}
                  className="flex flex-col gap-1 py-2 text-sm @sm:flex-row @sm:items-center @sm:justify-between @sm:gap-3"
                >
                  <span className="flex min-w-0 items-center gap-2 text-neutral-200">
                    <ColorDot size="xs" color={row.colorHex} />
                    <span className="truncate">{row.areaName}</span>
                  </span>
                  <span className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums text-neutral-400">
                    <span>{t('studyVsClass.classTime', { time: formatDuration(row.classMinutes) })}</span>
                    <span>{t('studyVsClass.studyTime', { time: formatDuration(row.studyMinutes) })}</span>
                    {row.ratio !== null && (
                      <span className="font-semibold text-violet-300">
                        {t('studyVsClass.ratio', { ratio: row.ratio })}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {unlinked.length > 0 && (
            <p className="mt-3 text-xs text-neutral-500">
              {t('studyVsClass.unlinked', { subjects: unlinked.join(', ') })}{' '}
              <Link to="/notebook" className="text-violet-400 underline decoration-dotted hover:text-violet-300">
                {t('studyVsClass.linkInNotebook')}
              </Link>
            </p>
          )}
        </>
      )}
    </Card>
  );
}
