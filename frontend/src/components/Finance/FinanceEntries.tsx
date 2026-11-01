import { useState } from 'react';
import Card from '../UI/Card';
import IconButton from '../UI/IconButton';
import Modal from '../UI/Modal';
import { PencilIcon, TrashIcon } from '../UI/Icons';
import FinanceEntryForm from './FinanceEntryForm';
import type { FinanceEntry, FinanceEntryInput, FinanceEntryKind, FinanceSummary } from '../../api/financeService';
import { formatMoney } from '../../lib/money';
import { useI18n } from '../../i18n/useI18n';

interface FinanceEntriesProps {
  summary: FinanceSummary;
  /** YYYY-MM-DD sugerido para novas entradas (hoje, ou dia 1 de outro mes). */
  defaultDate: string;
  /** Tipo pedido por um atalho (paleta); muda para recriar o formulario. */
  initialKind?: FinanceEntryKind;
  onAdd: (input: FinanceEntryInput) => Promise<boolean>;
  onUpdate: (id: string, changes: Partial<FinanceEntryInput>) => Promise<boolean>;
  onRemove: (entry: FinanceEntry) => void;
}

// Formulario + lista das ocorrencias do mes (as futuras marcadas como
// previstas) + gastos por categoria.
export default function FinanceEntries({ summary, defaultDate, initialKind, onAdd, onUpdate, onRemove }: FinanceEntriesProps) {
  const { t, lang } = useI18n();
  const money = (cents: number) => formatMoney(cents, summary.settings.currency, lang);
  const [editing, setEditing] = useState<FinanceEntry | null>(null);
  const entriesById = new Map(summary.entries.map((e) => [e.id, e]));
  const accountNames = new Map(summary.accounts.map((a) => [a.id, a.name]));
  const byCategory = Object.entries(summary.totals.expensesByCategory).sort((a, b) => b[1] - a[1]);

  return (
    <Card className="mb-6">
      <FinanceEntryForm key={initialKind ?? 'default'} accounts={summary.accounts} defaultDate={defaultDate} initialKind={initialKind} onSubmit={onAdd} />

      <h3 className="mt-6 mb-2 text-sm font-semibold text-neutral-200">{t('finance.entries')}</h3>
      {summary.occurrences.length === 0 ? (
        <p className="text-sm text-neutral-500">{t('finance.noEntries')}</p>
      ) : (
        <ul className="divide-y divide-neutral-800">
          {summary.occurrences.map((occ) => {
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
                    {occ.projected && (
                      <span className="rounded border border-dashed border-neutral-600 px-1.5 text-neutral-400">{t('finance.projected')}</span>
                    )}
                  </p>
                </div>
                <span className={`tabular-nums text-sm font-medium ${occ.kind === 'INCOME' ? 'text-cyan-400' : 'text-red-400'}`}>
                  {occ.kind === 'INCOME' ? '+' : '-'}
                  {money(occ.amountCents)}
                </span>
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
                  {money(cents)}
                  <span className="ml-2 text-xs text-neutral-500">{Math.round((cents / summary.totals.expenseCents) * 100)}%</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <Modal isOpen={editing !== null} onClose={() => setEditing(null)} title={t('finance.editEntry')} size="wide">
        {editing && (
          <FinanceEntryForm
            accounts={summary.accounts}
            defaultDate={defaultDate}
            entry={editing}
            onSubmit={(input) => onUpdate(editing.id, input)}
            onDone={() => setEditing(null)}
          />
        )}
      </Modal>
    </Card>
  );
}
