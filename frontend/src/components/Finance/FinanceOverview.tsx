import { useState, type FormEvent } from 'react';
import Card from '../UI/Card';
import Input from '../UI/Input';
import Select from '../UI/Select';
import ActionButton from '../UI/ActionButton';
import ProgressBar from '../UI/ProgressBar';
import { FINANCE_CURRENCIES, type FinanceSettings, type FinanceSummary } from '../../api/financeService';
import { centsToInput, formatMoney, parseMoneyInput } from '../../lib/money';
import { useI18n } from '../../i18n/useI18n';

interface FinanceOverviewProps {
  summary: FinanceSummary;
  onSaveSettings: (changes: Partial<FinanceSettings>) => Promise<boolean>;
}

function BudgetLine({ label, spent, limit, money }: { label: string; spent: number; limit: number | null; money: (c: number) => string }) {
  const { t } = useI18n();
  if (limit === null) return null;
  const over = spent - limit;
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="text-neutral-300">{label}</span>
        <span className={over > 0 ? 'text-red-400' : 'text-neutral-400'}>
          {over > 0
            ? t('finance.overBudget', { amount: money(over) })
            : t('finance.budgetUsed', { spent: money(spent), limit: money(limit) })}
        </span>
      </div>
      <ProgressBar
        percent={limit === 0 ? 100 : (spent / limit) * 100}
        fillClassName={over > 0 ? 'bg-red-500' : 'bg-violet-500'}
        thickness="md"
        className="mt-1"
        label={label}
      />
    </div>
  );
}

// Saldo atual (escrito a mao), somas do mes e limites de gastos/lazer.
export default function FinanceOverview({ summary, onSaveSettings }: FinanceOverviewProps) {
  const { t, lang } = useI18n();
  const { settings, totals } = summary;
  const money = (cents: number) => formatMoney(cents, settings.currency, lang);
  const [isEditing, setIsEditing] = useState(false);
  const [balance, setBalance] = useState('');
  const [budget, setBudget] = useState('');
  const [leisure, setLeisure] = useState('');
  const [currency, setCurrency] = useState(settings.currency);
  const [formError, setFormError] = useState('');

  const startEditing = () => {
    setBalance(centsToInput(settings.balanceCents));
    setBudget(centsToInput(settings.monthlyBudgetCents));
    setLeisure(centsToInput(settings.leisureBudgetCents));
    setCurrency(settings.currency);
    setFormError('');
    setIsEditing(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const balanceCents = parseMoneyInput(balance || '0');
    const monthlyBudgetCents = budget.trim() ? parseMoneyInput(budget) : null;
    const leisureBudgetCents = leisure.trim() ? parseMoneyInput(leisure) : null;
    if (
      balanceCents === null ||
      (budget.trim() && (monthlyBudgetCents === null || monthlyBudgetCents < 0)) ||
      (leisure.trim() && (leisureBudgetCents === null || leisureBudgetCents < 0))
    ) {
      setFormError(t('finance.invalidAmount'));
      return;
    }
    if (await onSaveSettings({ currency, balanceCents, monthlyBudgetCents, leisureBudgetCents })) {
      setIsEditing(false);
    }
  };

  return (
    <Card className="mb-6">
      {isEditing ? (
        <form onSubmit={(e) => void handleSubmit(e)} className="grid gap-3 sm:grid-cols-2">
          <Input label={t('finance.balance')} inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} />
          <Select label={t('finance.currency')} value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {FINANCE_CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </Select>
          <Input
            label={t('finance.monthlyBudget')}
            inputMode="decimal"
            placeholder={t('finance.noLimit')}
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
          />
          <Input
            label={t('finance.leisureBudget')}
            inputMode="decimal"
            placeholder={t('finance.noLimit')}
            value={leisure}
            onChange={(e) => setLeisure(e.target.value)}
          />
          {formError && <p className="text-sm text-red-400 sm:col-span-2">{formError}</p>}
          <div className="flex gap-2 sm:col-span-2">
            <ActionButton type="submit">{t('finance.save')}</ActionButton>
            <button type="button" onClick={() => setIsEditing(false)} className="px-3 py-2 text-sm text-neutral-400 hover:text-white">
              {t('common.cancel')}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-neutral-400">{t('finance.balance')}</p>
              <p className={`text-3xl font-semibold tabular-nums ${settings.balanceCents < 0 ? 'text-red-400' : 'text-white'}`}>
                {money(settings.balanceCents)}
              </p>
              <p className="text-xs text-neutral-500">{t('finance.balanceHelp')}</p>
            </div>
            <button type="button" onClick={startEditing} className="text-sm text-violet-400 hover:text-violet-300">
              {t('finance.editSettings')}
            </button>
          </div>
          <dl className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: t('finance.income'), value: totals.incomeCents, tone: 'text-cyan-400' },
              { label: t('finance.expenses'), value: totals.expenseCents, tone: 'text-red-400' },
              { label: t('finance.net'), value: totals.netCents, tone: totals.netCents < 0 ? 'text-red-400' : 'text-white' },
            ].map((item) => (
              <div key={item.label} className="rounded-lg bg-neutral-800/50 p-2">
                <dt className="text-xs text-neutral-400">{item.label}</dt>
                <dd className={`text-base sm:text-lg font-semibold tabular-nums ${item.tone}`}>{money(item.value)}</dd>
              </div>
            ))}
          </dl>
          <BudgetLine label={t('finance.monthlyBudget')} spent={totals.expenseCents} limit={settings.monthlyBudgetCents} money={money} />
          <BudgetLine label={t('finance.leisureBudget')} spent={totals.leisureCents} limit={settings.leisureBudgetCents} money={money} />
        </div>
      )}
    </Card>
  );
}
