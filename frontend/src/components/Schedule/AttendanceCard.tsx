import { CheckIcon } from '../UI/Icons';
import LinesSkeleton from '../UI/LinesSkeleton';
import { useAttendanceSummary } from '../../hooks/useAttendanceSummary';
import { useI18n } from '../../i18n/useI18n';
import Card from '../UI/Card';
import { useAbsenceLimitPref } from '../../hooks/useAbsenceLimitPref';
import {
  absenceRisk,
  absenceShare,
  MAX_ABSENCE_LIMIT_PCT,
  MIN_ABSENCE_LIMIT_PCT,
  type AbsenceRisk,
} from '../../lib/attendanceLimit';

// Etiqueta e cor por nivel de risco (tabela em vez de if/else).
const RISK_STYLE: Record<Exclude<AbsenceRisk, 'none'>, { labelKey: string; className: string }> = {
  near: { labelKey: 'attendance.limit.near', className: 'border-violet-700 bg-violet-900/30 text-violet-200' },
  over: { labelKey: 'attendance.limit.over', className: 'border-red-700 bg-red-900/30 text-red-200' },
};

interface AttendanceCardProps {
  refreshKey: number;
}

// Faltas por disciplina no periodo ativo, com as que tem mais faltas no
// topo. As presencas marcam-se em cada aula da vista semanal; sem aulas
// importadas o cartao nao aparece.
export default function AttendanceCard({ refreshKey }: AttendanceCardProps) {
  const { t } = useI18n();
  const { rows, isLoading, hasError } = useAttendanceSummary(refreshKey);
  const { limitPct, setLimit, resetLimit, isDefault } = useAbsenceLimitPref();
  if (!isLoading && !hasError && rows.length === 0) return null;
  const atRisk = rows.filter((row) => absenceRisk(row, limitPct) !== 'none').length;

  return (
    <Card>
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
          <CheckIcon className="text-violet-400" width={18} height={18} />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-white">{t('attendance.title')}</h2>
          <p className="text-sm text-neutral-400 mt-0.5">{t('attendance.description')}</p>
        </div>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
        <label htmlFor="absence-limit">{t('attendance.limit.label')}</label>
        <input
          id="absence-limit"
          type="number"
          inputMode="numeric"
          min={MIN_ABSENCE_LIMIT_PCT}
          max={MAX_ABSENCE_LIMIT_PCT}
          value={limitPct}
          onChange={(e) => setLimit(Number(e.target.value))}
          className="w-16 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-600/50"
        />
        <span>%</span>
        {!isDefault && (
          <button type="button" onClick={resetLimit} className="text-violet-400 hover:text-violet-300 underline decoration-dotted">
            {t('attendance.limit.reset')}
          </button>
        )}
      </div>
      {!isLoading && !hasError && atRisk > 0 && (
        <p role="status" className="mb-3 rounded-lg border border-red-800/60 bg-red-900/20 px-3 py-2 text-sm text-red-200">
          {t('attendance.limit.summary', { count: atRisk, limit: limitPct })}
        </p>
      )}
      {isLoading ? (
        <LinesSkeleton lines={3} />
      ) : hasError ? (
        <p className="text-sm text-red-400">{t('attendance.loadFailed')}</p>
      ) : (
        <ul className="@container divide-y divide-neutral-800">
          {rows.map((row) => {
            const risk = absenceRisk(row, limitPct);
            const share = absenceShare(row);
            return (
            <li
              key={row.subject}
              className="flex flex-col gap-1 py-2 text-sm @sm:flex-row @sm:items-center @sm:justify-between @sm:gap-3"
            >
              <span className="min-w-0 truncate text-neutral-200">{row.subject}</span>
              <span className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums">
                <span className={row.missed > 0 ? 'font-semibold text-red-400' : 'text-neutral-500'}>
                  {t('attendance.missedCount', { count: row.missed })}
                </span>
                <span className="text-neutral-400">{t('attendance.attendedCount', { count: row.attended })}</span>
                {row.unmarked > 0 && (
                  <span className="text-neutral-500">{t('attendance.unmarkedCount', { count: row.unmarked })}</span>
                )}
                {share !== null && row.missed > 0 && (
                  <span className="text-neutral-500">{t('attendance.limit.share', { pct: Math.round(share) })}</span>
                )}
                {risk !== 'none' && (
                  <span className={`rounded-full border px-2 py-0.5 font-medium ${RISK_STYLE[risk].className}`}>
                    {t(RISK_STYLE[risk].labelKey)}
                  </span>
                )}
              </span>
            </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
