import type { SecurityLogsStats } from '../../types/models';
import { useI18n } from '../../i18n/useI18n';

interface SecurityStatsCardsProps {
  stats: SecurityLogsStats | null;
}

export default function SecurityStatsCards({ stats }: SecurityStatsCardsProps) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4">
        <p className="text-xs font-medium text-neutral-400 uppercase">{t('ui.blockedLastHour')}</p>
        <p className="mt-1 text-2xl font-bold text-white">{stats?.totalLastHour ?? '-'}</p>
      </div>

      <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4">
        <p className="text-xs font-medium text-neutral-400 uppercase">{t('ui.blockedLast24h')}</p>
        <p className="mt-1 text-2xl font-bold text-white">{stats?.totalLast24h ?? '-'}</p>
      </div>

      <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4">
        <p className="text-xs font-medium text-neutral-400 uppercase mb-2">
          {t('ui.topOffendingIps24h')}
        </p>
        {!stats || stats.topOffenders.length === 0 ? (
          <p className="text-sm text-neutral-500">{t('ui.noBlocksInTheLast')}</p>
        ) : (
          <ul className="space-y-1">
            {stats.topOffenders.slice(0, 5).map((offender) => (
              <li key={offender.ip} className="flex items-center justify-between text-sm">
                <span className="font-mono text-neutral-300">{offender.ip}</span>
                <span className="text-violet-400 font-semibold">{offender.count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
