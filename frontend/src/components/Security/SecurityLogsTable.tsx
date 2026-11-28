import SecurityLogsTableHeader from './SecurityLogsTableHeader';
import SecurityLogRow from './SecurityLogRow';
import SecurityLogCard from './SecurityLogCard';
import Pagination from '../UI/Pagination';
import EmptyState from '../UI/EmptyState';
import type { SecurityLog } from '../../types/models';
import { useI18n } from '../../i18n/useI18n';
import type { SecurityLogSort, SecurityLogSortKey } from '../../lib/securityLogSort';

interface SecurityLogsTableProps {
  // Ja vem ordenados do servidor.
  logs: SecurityLog[];
  sort: SecurityLogSort;
  onSort: (key: SecurityLogSortKey) => void;
  total: number;
  skip: number;
  pageSize: number;
  onNextPage: () => void;
  onPrevPage: () => void;
  onBanIp: (ip: string) => void;
  bannedIpSet: Set<string>;
}

export default function SecurityLogsTable({
  logs,
  sort,
  onSort,
  total,
  skip,
  pageSize,
  onNextPage,
  onPrevPage,
  onBanIp,
  bannedIpSet,
}: SecurityLogsTableProps) {
  const { t } = useI18n();
  if (logs.length === 0) return <EmptyState message={t('ui.noBlockedRequestsFoundFor')} />;

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl overflow-hidden shadow-xl">
      <ul className="divide-y divide-neutral-800 md:hidden">
        {logs.map((log) => (
          <SecurityLogCard key={log.id} log={log} onBanIp={onBanIp} isBanned={bannedIpSet.has(log.ip)} />
        ))}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm text-left text-neutral-300 whitespace-nowrap">
          <SecurityLogsTableHeader sort={sort} onSort={onSort} />
          <tbody>
            {logs.map((log) => (
              <SecurityLogRow
                key={log.id}
                log={log}
                onBanIp={onBanIp}
                isBanned={bannedIpSet.has(log.ip)}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-neutral-800">
        <Pagination total={total} skip={skip} pageSize={pageSize} onNextPage={onNextPage} onPrevPage={onPrevPage} />
      </div>
    </div>
  );
}
