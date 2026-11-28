import { useState } from 'react';
import FormField from '../UI/FormField';
import Input from '../UI/Input';
import Select from '../UI/Select';
import Button from '../UI/Button';
import { RefreshIcon, DownloadIcon } from '../UI/Icons';
import type { SecurityLogsFiltersState } from '../../hooks/useSecurityLogsPage';
import { SECURITY_LOGS_EXPORT_MAX_ROWS } from '../../utils/securityLogsExport';
import { useI18n } from '../../i18n/useI18n';

interface SecurityLogsFiltersProps {
  filters: SecurityLogsFiltersState;
  onChange: (filters: SecurityLogsFiltersState) => void;
  onClear: () => void;
  onPurge: (olderThanDays?: number) => void;
  isPurging: boolean;
  onRefresh: () => void;
  onExport: () => void;
  isExporting: boolean;
  // Resultados com os filtros atuais (sem nenhum nao ha o que exportar).
  total: number;
}

// Idades (em dias) que o admin pode purgar; ALL apaga tudo.
const PURGE_DAY_OPTIONS = [7, 30, 90, 180, 365];
const DEFAULT_PURGE_DAYS = '30';
const PURGE_ALL = 'all';

export default function SecurityLogsFilters({
  filters,
  onChange,
  onClear,
  onPurge,
  isPurging,
  onRefresh,
  onExport,
  isExporting,
  total,
}: SecurityLogsFiltersProps) {
  const { t } = useI18n();
  const [purgeAge, setPurgeAge] = useState(DEFAULT_PURGE_DAYS);
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

        <div className="flex flex-wrap gap-2">
          {hasActiveFilters && (
            <Button type="button" variant="secondary" onClick={onClear} className="whitespace-nowrap">
              {t('ui.clearFilters')}
            </Button>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" onClick={onRefresh} className="inline-flex items-center gap-2">
          <RefreshIcon className="h-4 w-4" aria-hidden="true" />
          {t('ux4admin.logs.refresh')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={onExport}
          disabled={total === 0 || isExporting}
          title={t('f7admin.logs.exportHint', { max: SECURITY_LOGS_EXPORT_MAX_ROWS })}
          className="inline-flex items-center gap-2"
        >
          <DownloadIcon className="h-4 w-4" aria-hidden="true" />
          {isExporting ? t('f7admin.logs.exporting') : t('ux4admin.logs.export')}
        </Button>
      </div>

      <div className="mt-4 pt-4 border-t border-neutral-800 flex flex-wrap items-center gap-2">
        <span className="text-xs text-neutral-500 mr-auto">
          {t('ui.housekeepingPermanentlyDeleteStoredLogs')}
        </span>
        <Select
          aria-label={t('f7admin.logs.purgeLabel')}
          value={purgeAge}
          disabled={isPurging}
          onChange={(e) => setPurgeAge(e.target.value)}
        >
          {PURGE_DAY_OPTIONS.map((days) => (
            <option key={days} value={String(days)}>
              {t('f7admin.logs.purgeOlder', { days })}
            </option>
          ))}
          <option value={PURGE_ALL}>{t('f7admin.logs.purgeAll')}</option>
        </Select>
        <Button
          type="button"
          variant="secondary"
          disabled={isPurging}
          className="border-red-900 text-red-400 hover:border-red-600"
          onClick={() => onPurge(purgeAge === PURGE_ALL ? undefined : Number(purgeAge))}
        >
          {t('f7admin.logs.purgeButton')}
        </Button>
      </div>
    </div>
  );
}
