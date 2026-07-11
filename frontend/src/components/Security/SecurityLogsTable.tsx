import SecurityLogsTableHeader from './SecurityLogsTableHeader';
import SecurityLogRow from './SecurityLogRow';
import Button from '../UI/Button';
import type { SecurityLog } from '../../types/models';

interface SecurityLogsTableProps {
  logs: SecurityLog[];
  total: number;
  skip: number;
  pageSize: number;
  onNextPage: () => void;
  onPrevPage: () => void;
}

export default function SecurityLogsTable({
  logs,
  total,
  skip,
  pageSize,
  onNextPage,
  onPrevPage,
}: SecurityLogsTableProps) {
  const rangeStart = total === 0 ? 0 : skip + 1;
  const rangeEnd = Math.min(skip + pageSize, total);

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
              logs.map((log) => <SecurityLogRow key={log.id} log={log} />)
            )}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-800 text-sm text-neutral-400">
          <span>
            Showing {rangeStart}-{rangeEnd} of {total}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onPrevPage} disabled={skip === 0}>
              Previous
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={onNextPage}
              disabled={skip + pageSize >= total}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
