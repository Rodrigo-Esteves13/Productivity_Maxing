import SecurityLogsTableHeader from './SecurityLogsTableHeader';
import SecurityLogRow from './SecurityLogRow';
import Pagination from '../UI/Pagination';
import type { SecurityLog } from '../../types/models';

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
  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl overflow-hidden shadow-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-neutral-300 whitespace-nowrap">
          <SecurityLogsTableHeader />
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                  No blocked requests found for this filter.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <SecurityLogRow
                  key={log.id}
                  log={log}
                  onBanIp={onBanIp}
                  isBanned={bannedIpSet.has(log.ip)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="border-t border-neutral-800">
        <Pagination total={total} skip={skip} pageSize={pageSize} onNextPage={onNextPage} onPrevPage={onPrevPage} />
      </div>
    </div>
  );
}
