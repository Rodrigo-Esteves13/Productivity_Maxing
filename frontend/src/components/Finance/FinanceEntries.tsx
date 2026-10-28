import { useState, type FormEvent } from 'react';
import Card from '../UI/Card';
import Input from '../UI/Input';
import Select from '../UI/Select';
import ActionButton from '../UI/ActionButton';
import IconButton from '../UI/IconButton';
import SegmentedControl from '../UI/SegmentedControl';
import ToggleChip from '../UI/ToggleChip';
import { TrashIcon } from '../UI/Icons';
import {
  FINANCE_CATEGORIES,
  type FinanceEntry,
  type FinanceEntryInput,
  type FinanceEntryKind,
  type FinanceSummary,
} from '../../api/financeService';
import { formatMoney, parseMoneyInput } from '../../lib/money';
import { useI18n } from '../../i18n/useI18n';

const INCOME_CATEGORIES = ['SALARY', 'ALLOWANCE', 'SCHOLARSHIP', 'OTHER'];

interface FinanceEntriesProps {
  summary: FinanceSummary;
  /** YYYY-MM-DD sugerido para novas entradas (hoje, ou dia 1 de outro mes). */
  defaultDate: string;
  onAdd: (input: FinanceEntryInput) => Promise<boolean>;
  onRemove: (entry: FinanceEntry) => void;
}

// Formulario de entrada/saida + lista do mes + gastos por categoria.
export default function FinanceEntries({ summary, defaultDate, onAdd, onRemove }: FinanceEntriesProps) {
  const { t, lang } = useI18n();
  const money = (cents: number) => formatMoney(cents, summary.settings.currency, lang);
  const [kind, setKind] = useState<FinanceEntryKind>('EXPENSE');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('FOOD');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [recurring, setRecurring] = useState(false);
  const [formError, setFormError] = useState('');
  const categories = kind === 'INCOME' ? INCOME_CATEGORIES : FINANCE_CATEGORIES.filter((c) => !INCOME_CATEGORIES.includes(c) || c === 'OTHER');

  const changeKind = (next: FinanceEntryKind) => {
    setKind(next);
    setCategory(next === 'INCOME' ? 'SALARY' : 'FOOD');
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const amountCents = parseMoneyInput(amount);
    if (amountCents === null || amountCents <= 0) {
      setFormError(t('finance.invalidAmount'));
      return;
    }
    setFormError('');
    if (await onAdd({ kind, amountCents, category, note: note.trim() || undefined, date: date || defaultDate, recurring })) {
      setAmount('');
      setNote('');
      setRecurring(false);
    }
  };

  const byCategory = Object.entries(summary.totals.expensesByCategory).sort((a, b) => b[1] - a[1]);

  return (
    <Card className="mb-6">
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
        <SegmentedControl
          options={[
            { value: 'EXPENSE', label: t('finance.kind.EXPENSE') },
            { value: 'INCOME', label: t('finance.kind.INCOME') },
          ]}
          value={kind}
          onChange={changeKind}
          size="sm"
        />
        <div className="grid gap-3 sm:grid-cols-4">
          <Input label={t('finance.amount')} inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Select label={t('finance.category')} value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => (
              <option key={c} value={c}>
                {t(`finance.cat.${c}`)}
              </option>
            ))}
          </Select>
          <Input label={t('finance.date')} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input label={t('finance.note')} maxLength={120} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ToggleChip size="sm" pressed={recurring} onClick={() => setRecurring((v) => !v)}>
            {t('finance.recurring')}
          </ToggleChip>
          <ActionButton type="submit">{t('finance.addEntry')}</ActionButton>
          {formError && <p className="text-sm text-red-400">{formError}</p>}
        </div>
      </form>

      <h3 className="mt-6 mb-2 text-sm font-semibold text-neutral-200">{t('finance.entries')}</h3>
      {summary.entries.length === 0 ? (
        <p className="text-sm text-neutral-500">{t('finance.noEntries')}</p>
      ) : (
        <ul className="divide-y divide-neutral-800">
          {summary.entries.map((entry) => (
            <li key={entry.id} className="flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-neutral-200">
                  {t(`finance.cat.${entry.category}`)}
                  {entry.note && <span className="text-neutral-500"> · {entry.note}</span>}
                </p>
                <p className="text-xs text-neutral-500">
                  {entry.recurring
                    ? t('finance.recurringBadge')
                    : new Date(entry.date).toLocaleDateString(lang, { timeZone: 'UTC' })}
                </p>
              </div>
              <span className={`tabular-nums text-sm font-medium ${entry.kind === 'INCOME' ? 'text-cyan-400' : 'text-red-400'}`}>
                {entry.kind === 'INCOME' ? '+' : '-'}
                {money(entry.amountCents)}
              </span>
              <IconButton label={t('finance.deleteEntry')} tone="danger" onClick={() => onRemove(entry)}>
                <TrashIcon className="h-4 w-4" />
              </IconButton>
            </li>
          ))}
        </ul>
      )}

      {byCategory.length > 0 && (
        <>
          <h3 className="mt-6 mb-2 text-sm font-semibold text-neutral-200">{t('finance.byCategory')}</h3>
          <ul className="space-y-1 text-sm">
            {byCategory.map(([c, cents]) => (
              <li key={c} className="flex justify-between">
                <span className="text-neutral-400">{t(`finance.cat.${c}`)}</span>
                <span className="tabular-nums text-neutral-200">
                  {money(cents)}
                  <span className="ml-2 text-xs text-neutral-500">
                    {Math.round((cents / summary.totals.expenseCents) * 100)}%
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
