import FormField from '../UI/FormField';
import Input from '../UI/Input';
import Select from '../UI/Select';
import Button from '../UI/Button';
import { RefreshIcon, DownloadIcon } from '../UI/Icons';
import { useFeedback } from '../../context/useFeedback';
import { securityLogsToCsv, SECURITY_LOGS_CSV_COLUMNS } from '../../utils/securityLogsCsv';
import { downloadTextFile } from '../../utils/downloadTextFile';
import { todayKey } from '../../lib/dateKey';
import type { SecurityLog } from '../../types/models';
import type { SecurityLogsFiltersState } from '../../hooks/useSecurityLogsPage';
import { useI18n } from '../../i18n/useI18n';

interface SecurityLogsFiltersProps {
  filters: SecurityLogsFiltersState;
  onChange: (filters: SecurityLogsFiltersState) => void;
  onClear: () => void;
  onPurge: (olderThanDays?: number) => void;
  isPurging: boolean;
  onRefresh: () => void;
  // Linhas da pagina atual (o que o botao de exportar grava).
  logs: readonly SecurityLog[];
}

const CSV_MIME_TYPE = 'text/csv;charset=utf-8';
const CSV_FILE_PREFIX = 'pmaxing_security_logs_';

export default function SecurityLogsFilters({
  filters,
  onChange,
  onClear,
  onPurge,
  isPurging,
  onRefresh,
  logs,
}: SecurityLogsFiltersProps) {
  const { t } = useI18n();
  const { notify } = useFeedback();
  const update = (patch: Partial<SecurityLogsFiltersState>) => onChange({ ...filters, ...patch });
  const hasActiveFilters = filters.ip !== '' || filters.path !== '' || filters.window !== '';

  const handleExport = () => {
    const headers = SECURITY_LOGS_CSV_COLUMNS.map((column) => t(`ux4admin.logs.col.${column}`));
    downloadTextFile(securityLogsToCsv(logs, headers), `${CSV_FILE_PREFIX}${todayKey()}.csv`, CSV_MIME_TYPE);
    notify(t('ux4admin.logs.exported', { count: logs.length }), 'success');
  };

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
          onClick={handleExport}
          disabled={logs.length === 0}
          title={t('ux4admin.logs.exportHint')}
          className="inline-flex items-center gap-2"
        >
          <DownloadIcon className="h-4 w-4" aria-hidden="true" />
          {t('ux4admin.logs.export')}
        </Button>
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
