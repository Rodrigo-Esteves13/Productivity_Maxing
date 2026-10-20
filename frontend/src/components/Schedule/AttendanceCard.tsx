import { CheckIcon } from '../UI/Icons';
import LinesSkeleton from '../UI/LinesSkeleton';
import { useAttendanceSummary } from '../../hooks/useAttendanceSummary';
import { useI18n } from '../../i18n/useI18n';
import Card from '../UI/Card';

interface AttendanceCardProps {
  refreshKey: number;
}

// Faltas por disciplina no periodo ativo, com as que tem mais faltas no
// topo. As presencas marcam-se em cada aula da vista semanal; sem aulas
// importadas o cartao nao aparece.
export default function AttendanceCard({ refreshKey }: AttendanceCardProps) {
  const { t } = useI18n();
  const { rows, isLoading, hasError } = useAttendanceSummary(refreshKey);
  if (!isLoading && !hasError && rows.length === 0) return null;

  return (
    <Card className="mt-6">
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
          <CheckIcon className="text-violet-400" width={18} height={18} />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-white">{t('attendance.title')}</h2>
          <p className="text-sm text-neutral-400 mt-0.5">{t('attendance.description')}</p>
        </div>
      </div>
      {isLoading ? (
        <LinesSkeleton lines={3} />
      ) : hasError ? (
        <p className="text-sm text-red-400">{t('attendance.loadFailed')}</p>
      ) : (
        <ul className="divide-y divide-neutral-800">
          {rows.map((row) => (
            <li
              key={row.subject}
              className="flex flex-col gap-1 py-2 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3"
            >
              <span className="min-w-0 truncate text-neutral-200">{row.subject}</span>
              <span className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span className={row.missed > 0 ? 'font-semibold text-red-400' : 'text-neutral-500'}>
                  {t('attendance.missedCount', { count: row.missed })}
                </span>
                <span className="text-neutral-400">{t('attendance.attendedCount', { count: row.attended })}</span>
                {row.unmarked > 0 && (
                  <span className="text-neutral-600">{t('attendance.unmarkedCount', { count: row.unmarked })}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
