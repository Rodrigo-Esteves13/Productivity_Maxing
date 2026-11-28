import { useI18n } from '../../i18n/useI18n';
import type { SecurityLogSort, SecurityLogSortKey } from '../../lib/securityLogSort';

interface SecurityLogsTableHeaderProps {
  sort: SecurityLogSort;
  onSort: (key: SecurityLogSortKey) => void;
}

// Colunas ordenaveis (no servidor) e colunas so de leitura.
const COLUMNS: { key: SecurityLogSortKey | null; label: string }[] = [
  { key: 'createdAt', label: 'ui.when' },
  { key: 'ip', label: 'ui.ip' },
  { key: 'method', label: 'ui.method' },
  { key: 'path', label: 'ui.path' },
  { key: 'user', label: 'ui.user' },
  { key: null, label: 'ui.userAgent' },
];

const ARIA_SORT = { asc: 'ascending', desc: 'descending' } as const;
const SORT_MARK = { asc: '▲', desc: '▼' } as const;
const SORT_MARK_IDLE = '▲';

export default function SecurityLogsTableHeader({ sort, onSort }: SecurityLogsTableHeaderProps) {
  const { t } = useI18n();
  return (
    <thead className="text-xs text-neutral-400 uppercase bg-neutral-950/50 border-b border-neutral-800">
      <tr>
        {COLUMNS.map(({ key, label }) => {
          const active = key !== null && sort.key === key;
          return (
            <th
              key={label}
              scope="col"
              className="px-4 py-3 font-medium"
              aria-sort={active ? ARIA_SORT[sort.direction] : undefined}
            >
              {key === null ? (
                t(label)
              ) : (
                <button
                  type="button"
                  onClick={() => onSort(key)}
                  title={t('ux4admin.logs.sortBy', { column: t(label) })}
                  className="inline-flex items-center gap-1 uppercase hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400"
                >
                  {t(label)}
                  <span aria-hidden="true" className={active ? 'text-violet-400' : 'text-neutral-700'}>
                    {active ? SORT_MARK[sort.direction] : SORT_MARK_IDLE}
                  </span>
                </button>
              )}
            </th>
          );
        })}
      </tr>
    </thead>
  );
}
