import { useDeferredValue, useMemo, useState } from 'react';
import { useDirtyForm } from '../../hooks/useDirtyForm';
import Card from '../UI/Card';
import IconButton from '../UI/IconButton';
import Modal from '../UI/Modal';
import SearchField from '../UI/SearchField';
import Select from '../UI/Select';
import EmptyState from '../UI/EmptyState';
import Button from '../UI/Button';
import { PencilIcon, TrashIcon } from '../UI/Icons';
import FinanceEntryForm from './FinanceEntryForm';
import type { FinanceEntry, FinanceEntryInput, FinanceEntryKind, FinanceSummary } from '../../api/financeService';
import Money from './Money';
import type { SubmitOutcome } from '../../lib/idempotency';
import {
  distinctCategories,
  EMPTY_FINANCE_ENTRY_FILTER,
  FINANCE_FILTER_ALL,
  filterOccurrences,
  isFilteringEntries,
} from '../../lib/financeEntryFilter';
import { useI18n } from '../../i18n/useI18n';

interface FinanceEntriesProps {
  summary: FinanceSummary;
  /** YYYY-MM-DD sugerido para novas entradas (hoje, ou dia 1 de outro mes). */
  defaultDate: string;
  /** Tipo pedido por um atalho (paleta); muda para recriar o formulario. */
  initialKind?: FinanceEntryKind;
  onAdd: (input: FinanceEntryInput, key: string) => Promise<SubmitOutcome>;
  onUpdate: (id: string, changes: Partial<FinanceEntryInput>) => Promise<boolean>;
  onRemove: (entry: FinanceEntry) => void;
}

// Formulario + lista das ocorrencias do mes (as futuras marcadas como
// previstas) + gastos por categoria.
export default function FinanceEntries({ summary, defaultDate, initialKind, onAdd, onUpdate, onRemove }: FinanceEntriesProps) {
  const { t, lang } = useI18n();
  const { currency } = summary.settings;
  const [editing, setEditing] = useState<FinanceEntry | null>(null);
  const editDirty = useDirtyForm(editing !== null);
  const entriesById = new Map(summary.entries.map((e) => [e.id, e]));
  const accountNames = new Map(summary.accounts.map((a) => [a.id, a.name]));
  const [filter, setFilter] = useState(EMPTY_FINANCE_ENTRY_FILTER);
  const deferredQuery = useDeferredValue(filter.query);
  const categories = useMemo(() => distinctCategories(summary.occurrences), [summary.occurrences]);
  const filtering = isFilteringEntries(filter);
  const visible = useMemo(
    () =>
      filterOccurrences(
        summary.occurrences,
        { ...filter, query: deferredQuery },
        (category) => t(`finance.cat.${category}`),
        (accountId) => (accountId ? accountNames.get(accountId) : undefined),
      ),
    // accountNames e t mudam com summary/lingua; o filtro e a lista decidem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [summary.occurrences, summary.accounts, filter.category, filter.accountId, deferredQuery, t],
  );
  const byCategory = Object.entries(summary.totals.expensesByCategory).sort((a, b) => b[1] - a[1]);

  return (
    <Card className="mb-6">
      <FinanceEntryForm key={initialKind ?? 'default'} accounts={summary.accounts} defaultDate={defaultDate} initialKind={initialKind} currency={currency} onSubmit={onAdd} />

      <h3 className="mt-6 mb-2 text-sm font-semibold text-neutral-200">{t('finance.entries')}</h3>
      {summary.occurrences.length > 0 && (
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <SearchField value={filter.query} onChange={(query) => setFilter((f) => ({ ...f, query }))} label={t('ux4fin.search')} />
          <div className="min-w-40 flex-1 sm:max-w-48">
            <Select
              label={t('ux4fin.filterCategory')}
              value={filter.category}
              onChange={(e) => setFilter((f) => ({ ...f, category: e.target.value }))}
            >
              <option value={FINANCE_FILTER_ALL}>{t('ux4fin.allCategories')}</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {t(`finance.cat.${category}`)}
                </option>
              ))}
            </Select>
          </div>
          {summary.accounts.length > 0 && (
            <div className="min-w-40 flex-1 sm:max-w-48">
              <Select
                label={t('ux4fin.filterAccount')}
                value={filter.accountId}
                onChange={(e) => setFilter((f) => ({ ...f, accountId: e.target.value }))}
              >
                <option value={FINANCE_FILTER_ALL}>{t('ux4fin.allAccounts')}</option>
                {summary.accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
          {filtering && (
            <>
              <p className="text-xs text-neutral-500" aria-live="polite">
                {t('search.count', { shown: visible.length, total: summary.occurrences.length })}
              </p>
              <Button type="button" variant="secondary" size="sm" onClick={() => setFilter(EMPTY_FINANCE_ENTRY_FILTER)}>
                {t('ux4fin.clearFilters')}
              </Button>
            </>
          )}
        </div>
      )}
      {summary.occurrences.length === 0 ? (
        <EmptyState variant="inline" message={t('finance.noEntries')} />
      ) : visible.length === 0 ? (
        <EmptyState variant="inline" message={filter.query.trim() ? t('search.noResultsFor', { query: filter.query.trim() }) : t('search.noResults')} />
      ) : (
        <ul className="divide-y divide-neutral-800">
          {visible.map((occ) => {
            const entry = entriesById.get(occ.entryId);
            const account = occ.accountId ? accountNames.get(occ.accountId) : undefined;
            return (
              <li key={`${occ.entryId}-${occ.date}`} className={`flex items-center gap-3 py-2 ${occ.projected ? 'border-l-2 border-dashed border-neutral-600 pl-3' : ''}`}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-neutral-200">
                    {t(`finance.cat.${occ.category}`)}
                    {occ.note && <span className="text-neutral-500"> · {occ.note}</span>}
                  </p>
                  <p className="flex flex-wrap items-center gap-x-2 text-xs text-neutral-500">
                    <span>{new Date(`${occ.date}T00:00:00`).toLocaleDateString(lang)}</span>
                    {occ.frequency && <span>{t(`finance.freq.${occ.frequency}`)}</span>}
                    {account && <span>{account}</span>}
                    {occ.reason !== 'REGULAR' && (
                      <span className="rounded-full border border-amber-800 bg-amber-900/30 px-2 text-[11px] font-semibold text-amber-300">
                        {t(`finance.reason.${occ.reason}`)}
                      </span>
                    )}
                    {occ.projected && (
                      <span className="rounded border border-dashed border-neutral-600 px-1.5 text-neutral-400">{t('finance.projected')}</span>
                    )}
                  </p>
                </div>
                <Money
                  cents={occ.amountCents}
                  currency={currency}
                  prefix={occ.kind === 'INCOME' ? '+' : '-'}
                  className={`tabular-nums text-sm font-medium ${occ.kind === 'INCOME' ? 'text-cyan-400' : 'text-red-400'}`}
                />
                {entry && (
                  <>
                    <IconButton label={t('finance.editEntry')} onClick={() => setEditing(entry)}>
                      <PencilIcon className="h-4 w-4" />
                    </IconButton>
                    <IconButton label={t('finance.deleteEntry')} tone="danger" onClick={() => onRemove(entry)}>
                      <TrashIcon className="h-4 w-4" />
                    </IconButton>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {byCategory.length > 0 && summary.totals.expenseCents > 0 && (
        <>
          <h3 className="mt-6 mb-2 text-sm font-semibold text-neutral-200">{t('finance.byCategory')}</h3>
          <ul className="space-y-1 text-sm">
            {byCategory.map(([c, cents]) => (
              <li key={c} className="flex justify-between">
                <span className="text-neutral-400">{t(`finance.cat.${c}`)}</span>
                <span className="tabular-nums text-neutral-200">
                  <Money cents={cents} currency={currency} />
                  <span className="ml-2 text-xs text-neutral-500">{Math.round((cents / summary.totals.expenseCents) * 100)}%</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <Modal isOpen={editing !== null} onClose={() => setEditing(null)} title={t('finance.editEntry')} size="wide" isDirty={editDirty.isDirty}>
        {editing && (
          <div onInput={editDirty.markDirty}>
          <FinanceEntryForm
            accounts={summary.accounts}
            defaultDate={defaultDate}
            entry={editing}
            currency={currency}
            onSubmit={(input) => onUpdate(editing.id, input)}
            onDone={() => setEditing(null)}
          />
          </div>
        )}
      </Modal>
    </Card>
  );
}
