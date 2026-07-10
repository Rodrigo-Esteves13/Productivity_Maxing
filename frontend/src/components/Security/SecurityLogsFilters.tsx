import FormField from '../UI/FormField';
import Input from '../UI/Input';
import Select from '../UI/Select';
import Button from '../UI/Button';
import type { SecurityLogsFiltersState } from '../../hooks/useSecurityLogsPage';

interface SecurityLogsFiltersProps {
  filters: SecurityLogsFiltersState;
  onChange: (filters: SecurityLogsFiltersState) => void;
  onClear: () => void;
  onPurge: (olderThanDays?: number) => void;
  isPurging: boolean;
}

export default function SecurityLogsFilters({
  filters,
  onChange,
  onClear,
  onPurge,
  isPurging,
}: SecurityLogsFiltersProps) {
  const update = (patch: Partial<SecurityLogsFiltersState>) => onChange({ ...filters, ...patch });
  const hasActiveFilters = filters.ip !== '' || filters.path !== '' || filters.window !== '';

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 mb-6">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
        <FormField label="IP" htmlFor="filter-ip">
          <Input
            id="filter-ip"
            placeholder="203.0.113.7"
            value={filters.ip}
            onChange={(e) => update({ ip: e.target.value })}
          />
        </FormField>

        <FormField label="Path" htmlFor="filter-path">
          <Input
            id="filter-path"
            placeholder="/auth/login"
            value={filters.path}
            onChange={(e) => update({ path: e.target.value })}
          />
        </FormField>

        <FormField label="Window" htmlFor="filter-window">
          <Select
            id="filter-window"
            value={filters.window}
            onChange={(e) => update({ window: e.target.value as SecurityLogsFiltersState['window'] })}
          >
            <option value="">All time</option>
            <option value="1h">Last hour</option>
            <option value="24h">Last 24h</option>
            <option value="7d">Last 7 days</option>
          </Select>
        </FormField>

        <div className="flex gap-2">
          {hasActiveFilters && (
            <Button type="button" variant="secondary" onClick={onClear} className="whitespace-nowrap">
              Clear filters
            </Button>
          )}
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-neutral-800 flex flex-wrap items-center gap-2">
        <span className="text-xs text-neutral-500 mr-auto">
          Housekeeping: permanently delete stored logs.
        </span>
        <Button
          type="button"
          variant="secondary"
          disabled={isPurging}
          onClick={() => onPurge(30)}
        >
          Clear logs older than 30 days
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={isPurging}
          className="border-red-900 text-red-400 hover:border-red-600"
          onClick={() => onPurge(undefined)}
        >
          Clear all logs
        </Button>
      </div>
    </div>
  );
}
