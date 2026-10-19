import FormField from '../UI/FormField';
import Input from '../UI/Input';
import Select from '../UI/Select';
import Button from '../UI/Button';
import type { SecurityLogsFiltersState } from '../../hooks/useSecurityLogsPage';
import { useI18n } from '../../i18n/useI18n';

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
  const { t } = useI18n();
  const update = (patch: Partial<SecurityLogsFiltersState>) => onChange({ ...filters, ...patch });
  const hasActiveFilters = filters.ip !== '' || filters.path !== '' || filters.window !== '';

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 mb-6">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
        <FormField label={t('ui.ip')} htmlFor="filter-ip">
          <Input
            id="filter-ip"
            placeholder="203.0.113.7"
            value={filters.ip}
            onChange={(e) => update({ ip: e.target.value })}
          />
        </FormField>

        <FormField label={t('ui.path')} htmlFor="filter-path">
          <Input
            id="filter-path"
            placeholder="/auth/login"
            value={filters.path}
            onChange={(e) => update({ path: e.target.value })}
          />
        </FormField>

        <FormField label={t('ui.window')} htmlFor="filter-window">
          <Select
            id="filter-window"
            value={filters.window}
            onChange={(e) => update({ window: e.target.value as SecurityLogsFiltersState['window'] })}
          >
            <option value="">{t('ui.allTime')}</option>
            <option value="1h">{t('ui.lastHour')}</option>
            <option value="24h">{t('ui.last24h')}</option>
            <option value="7d">{t('ui.last7Days')}</option>
          </Select>
        </FormField>

        <div className="flex gap-2">
          {hasActiveFilters && (
            <Button type="button" variant="secondary" onClick={onClear} className="whitespace-nowrap">
              {t('ui.clearFilters')}
            </Button>
          )}
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-neutral-800 flex flex-wrap items-center gap-2">
        <span className="text-xs text-neutral-500 mr-auto">
          {t('ui.housekeepingPermanentlyDeleteStoredLogs')}
        </span>
        <Button
          type="button"
          variant="secondary"
          disabled={isPurging}
          onClick={() => onPurge(30)}
        >
          {t('ui.clearLogsOlderThan30')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={isPurging}
          className="border-red-900 text-red-400 hover:border-red-600"
          onClick={() => onPurge(undefined)}
        >
          {t('ui.clearAllLogs')}
        </Button>
      </div>
    </div>
  );
}
