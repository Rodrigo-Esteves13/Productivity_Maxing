import { useMemo, useState } from 'react';
import SecurityLogsTableHeader from './SecurityLogsTableHeader';
import SecurityLogRow from './SecurityLogRow';
import SecurityLogCard from './SecurityLogCard';
import Pagination from '../UI/Pagination';
import EmptyState from '../UI/EmptyState';
import type { SecurityLog } from '../../types/models';
import { useI18n } from '../../i18n/useI18n';
import {
  DEFAULT_SECURITY_LOG_SORT,
  nextSecurityLogSort,
  sortSecurityLogs,
  type SecurityLogSortKey,
} from '../../lib/securityLogSort';

interface SecurityLogsTableProps {
  logs: SecurityLog[];
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
  total,
  skip,
  pageSize,
  onNextPage,
  onPrevPage,
  onBanIp,
  bannedIpSet,
}: SecurityLogsTableProps) {
  const { t } = useI18n();
  const [sort, setSort] = useState(DEFAULT_SECURITY_LOG_SORT);
  const sorted = useMemo(() => sortSecurityLogs(logs, sort), [logs, sort]);
  const handleSort = (key: SecurityLogSortKey) => setSort((prev) => nextSecurityLogSort(prev, key));

  if (logs.length === 0) return <EmptyState message={t('ui.noBlockedRequestsFoundFor')} />;

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl overflow-hidden shadow-xl">
      <ul className="divide-y divide-neutral-800 md:hidden">
        {sorted.map((log) => (
          <SecurityLogCard key={log.id} log={log} onBanIp={onBanIp} isBanned={bannedIpSet.has(log.ip)} />
        ))}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm text-left text-neutral-300 whitespace-nowrap">
          <SecurityLogsTableHeader sort={sort} onSort={handleSort} />
          <tbody>
            {sorted.map((log) => (
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
