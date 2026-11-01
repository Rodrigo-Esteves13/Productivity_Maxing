import { useState, type FormEvent } from 'react';
import Input from '../UI/Input';
import Select from '../UI/Select';
import ActionButton from '../UI/ActionButton';
import SegmentedControl from '../UI/SegmentedControl';
import {
  FINANCE_CATEGORIES,
  FINANCE_FREQUENCIES,
  FINANCE_MAX_PAY_DAY,
  FINANCE_MIN_PAY_DAY,
  FINANCE_NOTE_MAX_LENGTH,
  FINANCE_PAY_DAY_RULES,
  type FinanceAccount,
  type FinanceEntry,
  type FinanceEntryInput,
  type FinanceEntryKind,
  type FinanceFrequency,
  type FinancePayDayRule,
} from '../../api/financeService';
import { centsToInput, parseMoneyInput } from '../../lib/money';
import { useI18n } from '../../i18n/useI18n';

const INCOME_CATEGORIES = ['SALARY', 'ALLOWANCE', 'SCHOLARSHIP', 'OTHER'];
const DEFAULT_CATEGORY: Record<FinanceEntryKind, string> = { EXPENSE: 'FOOD', INCOME: 'SALARY' };
const DAY_KEY_LENGTH = 10;
// '' = uma vez / mesmo dia da primeira data.
const NONE = '';

const categoriesFor = (kind: FinanceEntryKind) =>
  kind === 'INCOME' ? INCOME_CATEGORIES : FINANCE_CATEGORIES.filter((c) => !INCOME_CATEGORIES.includes(c) || c === 'OTHER');

interface FinanceEntryFormProps {
  accounts: FinanceAccount[];
  /** YYYY-MM-DD sugerido para novas entradas. */
  defaultDate: string;
  /** Entrada a editar; sem ela o formulario cria. */
  entry?: FinanceEntry;
  /** Tipo inicial ao criar (atalhos da paleta). */
  initialKind?: FinanceEntryKind;
  onSubmit: (input: FinanceEntryInput) => Promise<boolean>;
  onDone?: () => void;
}

// Formulario de entrada/saida: valor unico ou regra que se repete (semanal,
// mensal com regra de dia de pagamento, anual), com data de fim e conta.
export default function FinanceEntryForm({ accounts, defaultDate, entry, initialKind = 'EXPENSE', onSubmit, onDone }: FinanceEntryFormProps) {
  const { t } = useI18n();
  const [kind, setKind] = useState<FinanceEntryKind>(entry?.kind ?? initialKind);
  const [amount, setAmount] = useState(entry ? centsToInput(entry.amountCents) : '');
  const [category, setCategory] = useState(entry?.category ?? DEFAULT_CATEGORY[initialKind]);
  const [note, setNote] = useState(entry?.note ?? '');
  const [date, setDate] = useState(entry ? entry.date.slice(0, DAY_KEY_LENGTH) : defaultDate);
  const [frequency, setFrequency] = useState<FinanceFrequency | typeof NONE>(entry?.frequency ?? NONE);
  const [payDayRule, setPayDayRule] = useState<FinancePayDayRule | typeof NONE>(entry?.payDayRule ?? NONE);
  const [payDay, setPayDay] = useState(entry?.payDay ? String(entry.payDay) : '');
  const [endDate, setEndDate] = useState(entry?.endDate ? entry.endDate.slice(0, DAY_KEY_LENGTH) : '');
  const [accountId, setAccountId] = useState(entry?.accountId ?? NONE);
  const [formError, setFormError] = useState('');

  const isRule = frequency !== NONE;
  const showPayRule = frequency === 'MONTHLY';
  const showPayDay = showPayRule && payDayRule === 'FIXED_DAY';

  const changeKind = (next: FinanceEntryKind) => {
    setKind(next);
    setCategory(DEFAULT_CATEGORY[next]);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const amountCents = parseMoneyInput(amount);
    if (amountCents === null || amountCents <= 0) {
      setFormError(t('finance.invalidAmount'));
      return;
    }
    const day = Number(payDay);
    if (showPayDay && payDay && !(Number.isInteger(day) && day >= FINANCE_MIN_PAY_DAY && day <= FINANCE_MAX_PAY_DAY)) {
      setFormError(t('finance.invalidPayDay', { min: FINANCE_MIN_PAY_DAY, max: FINANCE_MAX_PAY_DAY }));
      return;
    }
    if (isRule && endDate && endDate < date) {
      setFormError(t('finance.invalidEndDate'));
      return;
    }
    setFormError('');
    const input: FinanceEntryInput = {
      kind,
      amountCents,
      category,
      // '' (e nao undefined) para que apagar a nota ao editar a limpe mesmo.
      note: note.trim(),
      date: date || defaultDate,
      frequency: isRule ? frequency : null,
      payDayRule: showPayRule && payDayRule !== NONE ? payDayRule : null,
      payDay: showPayDay && payDay ? day : null,
      endDate: isRule && endDate ? endDate : null,
      accountId: accountId || null,
    };
    if (await onSubmit(input)) {
      if (!entry) {
        setAmount('');
        setNote('');
        setFrequency(NONE);
        setPayDayRule(NONE);
        setPayDay('');
        setEndDate('');
      }
      onDone?.();
    }
  };

  return (
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input id="finance-entry-amount" label={t('finance.amount')} inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Select label={t('finance.category')} value={category} onChange={(e) => setCategory(e.target.value)}>
          {categoriesFor(kind).map((c) => (
            <option key={c} value={c}>
              {t(`finance.cat.${c}`)}
            </option>
          ))}
        </Select>
        <Input label={isRule ? t('finance.firstDate') : t('finance.date')} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Input label={t('finance.note')} maxLength={FINANCE_NOTE_MAX_LENGTH} value={note} onChange={(e) => setNote(e.target.value)} />
        <Select label={t('finance.frequency')} value={frequency} onChange={(e) => setFrequency(e.target.value as FinanceFrequency | typeof NONE)}>
          <option value={NONE}>{t('finance.freq.ONCE')}</option>
          {FINANCE_FREQUENCIES.map((f) => (
            <option key={f} value={f}>
              {t(`finance.freq.${f}`)}
            </option>
          ))}
        </Select>
        {showPayRule && (
          <Select label={t('finance.payDayRule')} value={payDayRule} onChange={(e) => setPayDayRule(e.target.value as FinancePayDayRule | typeof NONE)}>
            <option value={NONE}>{t('finance.payRule.SAME_DAY')}</option>
            {FINANCE_PAY_DAY_RULES.map((rule) => (
              <option key={rule} value={rule}>
                {t(`finance.payRule.${rule}`)}
              </option>
            ))}
          </Select>
        )}
        {showPayDay && (
          <Input
            label={t('finance.payDay')}
            type="number"
            inputMode="numeric"
            min={FINANCE_MIN_PAY_DAY}
            max={FINANCE_MAX_PAY_DAY}
            value={payDay}
            onChange={(e) => setPayDay(e.target.value)}
          />
        )}
        {isRule && <Input label={t('finance.endDate')} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />}
        <Select label={t('finance.account')} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value={NONE}>{t('finance.noAccount')}</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <ActionButton type="submit">{entry ? t('finance.save') : t('finance.addEntry')}</ActionButton>
        {onDone && entry && (
          <button type="button" onClick={onDone} className="px-3 py-2 text-sm text-neutral-400 hover:text-white">
            {t('common.cancel')}
          </button>
        )}
        {formError && <p className="text-sm text-red-400">{formError}</p>}
      </div>
    </form>
  );
}
