import Input from '../UI/Input';
import Select from '../UI/Select';
import ToggleRow from '../UI/ToggleRow';
import {
  FINANCE_DEBTOR_NAME_MAX_LENGTH,
  FINANCE_INTEREST_KINDS,
  FINANCE_MAX_RATE_PCT,
  type FinanceInterestKind,
} from '../../api/financeService';
import type { OwedState } from '../../lib/financeFormState';
import { formatPercent } from '../../lib/money';
import { useI18n } from '../../i18n/useI18n';

interface FinanceOwedFieldsProps {
  value: OwedState;
  onChange: (patch: Partial<OwedState>) => void;
}

// "Alguem me deve este dinheiro": enquanto nao for recebido nao conta no saldo.
export default function FinanceOwedFields({ value, onChange }: FinanceOwedFieldsProps) {
  const { t, lang } = useI18n();
  const hasRate = Number(value.rate.replace(',', '.')) > 0;
  return (
    <fieldset className="space-y-3 rounded-lg border border-neutral-800 p-3">
      <legend className="px-1 text-sm font-semibold text-neutral-200">{t('finance.owed.title')}</legend>
      <ToggleRow
        variant="inline"
        label={t('finance.owed.toggle')}
        description={t('finance.owed.toggleHelp')}
        checked={value.on}
        onChange={(on) => onChange({ on })}
      />
      {value.on && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label={t('finance.owed.debtor')}
            maxLength={FINANCE_DEBTOR_NAME_MAX_LENGTH}
            value={value.debtor}
            onChange={(e) => onChange({ debtor: e.target.value })}
          />
          <Input
            label={hasRate ? t('finance.owed.expectedRequired') : t('finance.owed.expected')}
            type="date"
            value={value.expectedDate}
            onChange={(e) => onChange({ expectedDate: e.target.value })}
          />
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm text-neutral-300" htmlFor="finance-owed-risk">
              {t('finance.owed.risk', { percent: formatPercent(value.riskPct, lang) })}
            </label>
            <input
              id="finance-owed-risk"
              type="range"
              min={0}
              max={100}
              step={5}
              value={value.riskPct}
              onChange={(e) => onChange({ riskPct: Number(e.target.value) })}
              className="w-full accent-violet-500"
            />
            <p className="text-xs text-neutral-500">{t('finance.owed.riskHelp')}</p>
          </div>
          <Input
            label={t('finance.owed.rate')}
            inputMode="decimal"
            placeholder="0"
            max={FINANCE_MAX_RATE_PCT}
            value={value.rate}
            onChange={(e) => onChange({ rate: e.target.value })}
          />
          {hasRate && (
            <Select
              label={t('finance.owed.interestKind')}
              value={value.interestKind}
              onChange={(e) => onChange({ interestKind: e.target.value as FinanceInterestKind })}
            >
              {FINANCE_INTEREST_KINDS.filter((k) => k !== 'NONE').map((k) => (
                <option key={k} value={k}>
                  {t(`finance.owed.interest.${k}`)}
                </option>
              ))}
            </Select>
          )}
        </div>
      )}
    </fieldset>
  );
}
