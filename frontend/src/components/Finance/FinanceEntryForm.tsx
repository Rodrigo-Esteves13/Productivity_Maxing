import { useMemo, useState, type FormEvent } from 'react';
import Input from '../UI/Input';
import Select from '../UI/Select';
import SegmentedControl from '../UI/SegmentedControl';
import FinanceSubmitButton from './FinanceSubmitButton';
import FinanceSalaryFields from './FinanceSalaryFields';
import FinanceOwedFields from './FinanceOwedFields';
import { DEFAULT_OWED, DEFAULT_SALARY, type OwedState, type SalaryState } from '../../lib/financeFormState';
import {
  FINANCE_CATEGORIES,
  FINANCE_FREQUENCIES,
  FINANCE_MAX_PAY_DAY,
  FINANCE_MIN_PAY_DAY,
  FINANCE_NOTE_MAX_LENGTH,
  FINANCE_MAX_RATE_PCT,
  FINANCE_PAY_DAY_RULES,
  type FinanceAccount,
  type FinanceEntry,
  type FinanceEntryInput,
  type FinanceEntryKind,
  type FinanceFrequency,
  type FinancePayDayRule,
} from '../../api/financeService';
import { centsToInput, parseMoneyInput } from '../../lib/money';
import { previewOccurrences } from '../../lib/financeSchedule';
import { toLocalDateKey } from '../../lib/dateKey';
import type { SubmitOutcome } from '../../lib/idempotency';
import { useIdempotentSubmit } from '../../hooks/useIdempotentSubmit';
import { usePrivateInputClass } from '../../hooks/usePrivacyMode';
import { useI18n } from '../../i18n/useI18n';

const INCOME_CATEGORIES = ['SALARY', 'ALLOWANCE', 'SCHOLARSHIP', 'OTHER'];
const DEFAULT_CATEGORY: Record<FinanceEntryKind, string> = { EXPENSE: 'FOOD', INCOME: 'SALARY' };
const DAY_KEY_LENGTH = 10;
// '' = uma vez / mesmo dia da primeira data.
const NONE = '';
const PREVIEW_COUNT = 3;
const RATE_PATTERN = /^\d+([.,]\d{1,3})?$/;
const MAX_RISK_PCT = 100;
const DEFAULT_SKIP = 1;

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
  currency: string;
  /** `key` e a Idempotency-Key da tentativa (ignorada ao editar). */
  onSubmit: (input: FinanceEntryInput, key: string) => Promise<SubmitOutcome>;
  onDone?: () => void;
}

// Formulario de entrada/saida: valor unico ou regra que se repete (semanal,
// mensal com regra de dia de pagamento, anual), com data de fim e conta.
export default function FinanceEntryForm({ accounts, defaultDate, entry, initialKind = 'EXPENSE', currency, onSubmit, onDone }: FinanceEntryFormProps) {
  const { t } = useI18n();
  const { submit, isSubmitting } = useIdempotentSubmit();
  const privateInput = usePrivateInputClass();
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
  const [salary, setSalary] = useState<SalaryState>(() =>
    entry
      ? {
          received: entry.skipFirstOccurrences > 0 ? 'yes' : 'no',
          arrearsOn: entry.paidInArrearsMonths > 0,
          arrearsMonths: entry.paidInArrearsMonths || DEFAULT_SALARY.arrearsMonths,
          withheldOn: entry.withheldCents !== null,
          withheld: centsToInput(entry.withheldCents),
        }
      : DEFAULT_SALARY,
  );
  const [owed, setOwed] = useState<OwedState>(() =>
    entry?.isOwed
      ? {
          on: true,
          debtor: entry.debtorName ?? '',
          expectedDate: entry.expectedDate ? entry.expectedDate.slice(0, DAY_KEY_LENGTH) : '',
          riskPct: entry.latePaymentRiskPct ?? 0,
          rate: entry.interestRatePct ?? '',
          interestKind: entry.interestKind && entry.interestKind !== 'NONE' ? entry.interestKind : DEFAULT_OWED.interestKind,
        }
      : DEFAULT_OWED,
  );
  const [formError, setFormError] = useState('');

  const isRule = frequency !== NONE;
  const showPayRule = frequency === 'MONTHLY';
  const showPayDay = showPayRule && payDayRule === 'FIXED_DAY';
  const isIncome = kind === 'INCOME';
  const showOwed = isIncome && !isRule;
  const owedOn = showOwed && owed.on;
  const showReceived = isIncome && showPayRule;
  const withheldCents = isIncome && isRule && salary.withheldOn ? parseMoneyInput(salary.withheld) : null;
  const previousSkip = entry?.skipFirstOccurrences ?? 0;
  // "Ja recebi" = saltar a primeira; sem a pergunta mantem o valor guardado.
  const skipFirst = !isRule ? 0 : !showReceived ? previousSkip : salary.received === 'yes' ? Math.max(DEFAULT_SKIP, previousSkip) : 0;
  const arrears = showPayRule && isIncome && salary.arrearsOn ? salary.arrearsMonths : 0;
  const amountPreview = parseMoneyInput(amount);

  const preview = useMemo(() => {
    if (!isIncome || !isRule || !date || !amountPreview || amountPreview <= 0) return [];
    return previewOccurrences(
      {
        date,
        frequency: frequency as FinanceFrequency,
        payDayRule: showPayRule && payDayRule !== NONE ? payDayRule : null,
        payDay: showPayDay && Number(payDay) ? Number(payDay) : null,
        endDate: endDate || null,
        skipFirstOccurrences: skipFirst,
        paidInArrearsMonths: arrears,
        amountCents: amountPreview,
        withheldCents: withheldCents ?? 0,
      },
      toLocalDateKey(new Date()),
      PREVIEW_COUNT,
    );
  }, [isIncome, isRule, date, amountPreview, frequency, showPayRule, payDayRule, showPayDay, payDay, endDate, skipFirst, arrears, withheldCents]);

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
    if (isIncome && isRule && salary.withheldOn && (withheldCents === null || withheldCents <= 0)) {
      setFormError(t('finance.invalidAmount'));
      return;
    }
    if (withheldCents !== null && withheldCents > amountCents) {
      setFormError(t('finance.salary.withheldTooBig'));
      return;
    }
    const rate = owed.rate.trim();
    const rateValue = Number(rate.replace(',', '.'));
    const hasRate = owedOn && rate !== '' && rateValue > 0;
    if (owedOn) {
      if (rate !== '' && (!RATE_PATTERN.test(rate) || rateValue > FINANCE_MAX_RATE_PCT)) {
        setFormError(t('finance.owed.invalidRate'));
        return;
      }
      if (hasRate && !owed.expectedDate) {
        setFormError(t('finance.owed.expectedNeeded'));
        return;
      }
      // Ja recebido: `date` e o dia do pagamento (pode ser depois do prazo).
      if (!entry?.receivedAt && owed.expectedDate && owed.expectedDate < date) {
        setFormError(t('finance.owed.expectedBeforeDate'));
        return;
      }
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
      // Campos de salario so com a repeticao certa (senao o backend recusa).
      ...(isRule && { skipFirstOccurrences: skipFirst }),
      ...(showPayRule && { paidInArrearsMonths: arrears }),
      ...(isIncome && isRule && { withheldCents }),
      ...(owedOn && {
        isOwed: true,
        debtorName: owed.debtor.trim() || null,
        expectedDate: owed.expectedDate || null,
        latePaymentRiskPct: Math.min(MAX_RISK_PCT, owed.riskPct),
        interestRatePct: hasRate ? rateValue : null,
        interestKind: hasRate ? owed.interestKind : null,
      }),
      ...(!owedOn && entry?.isOwed && { isOwed: false }),
    };
    const ok = await submit((key) => onSubmit(input, key));
    if (ok) {
      if (!entry) {
        setAmount('');
        setNote('');
        setFrequency(NONE);
        setPayDayRule(NONE);
        setPayDay('');
        setEndDate('');
        setSalary(DEFAULT_SALARY);
        setOwed(DEFAULT_OWED);
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
        <Input id="finance-entry-amount" className={privateInput} label={t('finance.amount')} inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Select label={t('finance.category')} value={category} onChange={(e) => setCategory(e.target.value)}>
          {categoriesFor(kind).map((c) => (
            <option key={c} value={c}>
              {t(`finance.cat.${c}`)}
            </option>
          ))}
        </Select>
        <Input label={isRule ? t('finance.firstDate') : owedOn ? t('finance.owed.lentOn') : t('finance.date')} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
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
      {isIncome && isRule && (
        <FinanceSalaryFields
          value={salary}
          onChange={(patch) => setSalary((prev) => ({ ...prev, ...patch }))}
          showReceived={showReceived}
          showArrears={showPayRule}
          showWithheld
          stacksWithRule={payDayRule === 'FIRST_BUSINESS_DAY_NEXT_MONTH'}
          preview={preview}
          currency={currency}
          hasEndDate={Boolean(endDate)}
        />
      )}
      {showOwed && <FinanceOwedFields value={owed} onChange={(patch) => setOwed((prev) => ({ ...prev, ...patch }))} />}
      <div className="flex flex-wrap items-center gap-3">
        <FinanceSubmitButton isSubmitting={isSubmitting}>{entry ? t('finance.save') : t('finance.addEntry')}</FinanceSubmitButton>
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
