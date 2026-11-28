import { useState } from 'react';
import { getFinanceExport } from '../../api/financeService';
import Button from '../UI/Button';
import Select from '../UI/Select';
import SelectionToolbar from '../UI/SelectionToolbar';
import SortDirectionButton from '../UI/SortDirectionButton';
import { DownloadIcon, TrashIcon } from '../UI/Icons';
import { FINANCE_CSV_COLUMNS, financeToCsv } from '../../utils/financeCsv';
import { downloadTextFile } from '../../utils/downloadTextFile';
import { todayKey } from '../../lib/dateKey';
import { FINANCE_SORT_FIELDS, type FinanceEntrySort, type FinanceSortField } from '../../lib/financeEntrySort';
import { useFeedback } from '../../context/useFeedback';
import { useI18n } from '../../i18n/useI18n';

interface FinanceEntriesBulkBarProps {
  sort: FinanceEntrySort;
  onSortChange: (sort: FinanceEntrySort) => void;
  selectedIds: string[];
  selectableCount: number;
  listCount: number;
  onSelectAll: () => void;
  onSelectNone: () => void;
  onDelete: () => void;
}

// Ordenar a lista de movimentos e agir sobre os selecionados (exportar, apagar).
export default function FinanceEntriesBulkBar({
  sort,
  onSortChange,
  selectedIds,
  selectableCount,
  listCount,
  onSelectAll,
  onSelectNone,
  onDelete,
}: FinanceEntriesBulkBarProps) {
  const { t } = useI18n();
  const { notify } = useFeedback();
  const [isExporting, setIsExporting] = useState(false);
  const count = selectedIds.length;

  // Mesmo CSV do export completo, so com as linhas selecionadas.
  const exportSelected = async () => {
    setIsExporting(true);
    try {
      const data = await getFinanceExport();
      const ids = new Set(selectedIds);
      const entries = data.entries.filter((entry) => ids.has(entry.id));
      const csv = financeToCsv(
        { ...data, entries, owedPayments: [] },
        {
          headers: FINANCE_CSV_COLUMNS.map((key) => t(`financeExport.col.${key}`)),
          paymentNote: t('financeExport.paymentNote'),
        },
      );
      downloadTextFile(csv, `pmaxing_money_selection_${todayKey()}.csv`, 'text/csv;charset=utf-8');
      // O export do servidor tem um teto: avisa se faltarem linhas.
      const complete = entries.length === ids.size;
      notify(t(complete ? 'ux4fin.exportDone' : 'financeFixes.export.truncated'), complete ? 'success' : 'info');
    } catch {
      notify(t('financeExport.error'), 'error');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      className={`mb-3 flex flex-wrap items-center gap-3 ${
        count > 0 ? 'sticky top-2 z-20 rounded-lg border border-violet-800/50 bg-neutral-900/95 px-3 py-2 backdrop-blur' : ''
      }`}
    >
      <SelectionToolbar
        selectedCount={count}
        selectableCount={selectableCount}
        onSelectAll={onSelectAll}
        onSelectNone={onSelectNone}
      />
      {listCount > selectableCount && (
        <span className="text-xs text-neutral-500">{t('f7money.selectLimit', { count: selectableCount })}</span>
      )}
      {count > 0 && (
        <p role="status" className="text-sm tabular-nums text-neutral-200">
          {t('f7money.selected', { count })}
        </p>
      )}
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {count > 0 && (
          <>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isExporting}
              aria-busy={isExporting}
              onClick={() => void exportSelected()}
              className="flex items-center gap-1.5"
            >
              <DownloadIcon className="h-4 w-4" />
              {t('f7money.exportSelected')}
            </Button>
            <Button type="button" variant="danger" size="sm" onClick={onDelete} className="flex items-center gap-1.5">
              <TrashIcon />
              {t('common.delete')}
            </Button>
          </>
        )}
        <Select
          aria-label={t('f7money.sortBy')}
          value={sort.field}
          onChange={(e) => onSortChange({ ...sort, field: e.target.value as FinanceSortField })}
          className="py-1 text-sm"
        >
          {FINANCE_SORT_FIELDS.map((field) => (
            <option key={field} value={field}>
              {t(`f7money.sort.${field}`)}
            </option>
          ))}
        </Select>
        <SortDirectionButton
          direction={sort.direction}
          onToggle={() => onSortChange({ ...sort, direction: sort.direction === 'asc' ? 'desc' : 'asc' })}
          ascLabel={t('f7money.sortAsc')}
          descLabel={t('f7money.sortDesc')}
        />
      </div>
    </div>
  );
}
