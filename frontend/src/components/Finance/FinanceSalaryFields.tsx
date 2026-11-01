import Input from '../UI/Input';
import Select from '../UI/Select';
import SegmentedControl from '../UI/SegmentedControl';
import ToggleRow from '../UI/ToggleRow';
import Money from './Money';
import { FINANCE_MAX_ARREARS_MONTHS } from '../../api/financeService';
import type { PreviewOccurrence } from '../../lib/financeSchedule';
import type { SalaryState } from '../../lib/financeFormState';
import { usePrivateInputClass } from '../../hooks/usePrivacyMode';
import { useI18n } from '../../i18n/useI18n';

const ARREARS_OPTIONS = Array.from({ length: FINANCE_MAX_ARREARS_MONTHS }, (_, i) => i + 1);
const BADGE_REASONS = ['WITHHELD_FIRST', 'WITHHELD_RELEASE'];

interface FinanceSalaryFieldsProps {
  value: SalaryState;
  onChange: (patch: Partial<SalaryState>) => void;
  /** Pergunta "ja recebeste": so rendimento mensal. */
  showReceived: boolean;
  /** Atraso no pagamento: so rendimento mensal. */
  showArrears: boolean;
  /** Retencao do empregador: rendimento que se repete. */
  showWithheld: boolean;
  /** Regra "primeiro dia util do mes seguinte" ja e um atraso de 1 mes. */
  stacksWithRule: boolean;
  preview: PreviewOccurrence[];
  currency: string;
  hasEndDate: boolean;
}

// Perguntas guiadas para um salario: ja recebeu este mes, pago com atraso e
// retencao do empregador, com as proximas 3 ocorrencias estimadas.
export default function FinanceSalaryFields({
  value,
  onChange,
  showReceived,
  showArrears,
  showWithheld,
  stacksWithRule,
  preview,
  currency,
  hasEndDate,
}: FinanceSalaryFieldsProps) {
  const { t, lang } = useI18n();
  const privateInput = usePrivateInputClass();
  return (
    <fieldset className="space-y-3 rounded-lg border border-neutral-800 p-3">
      <legend className="px-1 text-sm font-semibold text-neutral-200">{t('finance.salary.title')}</legend>
      {showReceived && (
        <div>
          <p className="mb-1 text-sm text-neutral-300">{t('finance.salary.receivedQuestion')}</p>
          <SegmentedControl
            options={[
              { value: 'yes', label: t('finance.salary.receivedYes') },
              { value: 'no', label: t('finance.salary.receivedNo') },
            ]}
            value={value.received}
            onChange={(received) => onChange({ received })}
            size="sm"
          />
        </div>
      )}
      {showArrears && (
        <div>
          <ToggleRow
            variant="inline"
            label={t('finance.salary.arrears')}
            description={t('finance.salary.arrearsHelp')}
            checked={value.arrearsOn}
            onChange={(arrearsOn) => onChange({ arrearsOn })}
          />
          {value.arrearsOn && (
            <div className="mt-2 max-w-xs">
              <Select
                label={t('finance.salary.arrearsMonths')}
                value={String(value.arrearsMonths)}
                onChange={(e) => onChange({ arrearsMonths: Number(e.target.value) })}
              >
                {ARREARS_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {t('finance.salary.monthsLater', { count: n })}
                  </option>
                ))}
              </Select>
            </div>
          )}
          {value.arrearsOn && stacksWithRule && (
            <p role="status" className="mt-2 rounded-lg border border-amber-800/50 bg-amber-900/10 p-2 text-xs text-amber-300">
              {t('finance.salary.stackWarning')}
            </p>
          )}
        </div>
      )}
      {showWithheld && (
        <div>
          <ToggleRow
            variant="inline"
            label={t('finance.salary.withheld')}
            description={t('finance.salary.withheldHelp')}
            checked={value.withheldOn}
            onChange={(withheldOn) => onChange({ withheldOn })}
          />
          {value.withheldOn && (
            <div className="mt-2 max-w-xs">
              <Input
                className={privateInput}
                label={t('finance.salary.withheldAmount')}
                inputMode="decimal"
                placeholder="0.00"
                value={value.withheld}
                onChange={(e) => onChange({ withheld: e.target.value })}
              />
              {!hasEndDate && <p className="mt-1 text-xs text-neutral-500">{t('finance.salary.withheldNoEnd')}</p>}
            </div>
          )}
        </div>
      )}
      {preview.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-neutral-400">{t('finance.salary.preview')}</p>
          <ul className="space-y-1 text-sm">
            {preview.map((o) => (
              <li key={`${o.date}-${o.reason}`} className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-neutral-300">{new Date(`${o.date}T00:00:00`).toLocaleDateString(lang)}</span>
                <span className="flex items-center gap-2">
                  {BADGE_REASONS.includes(o.reason) && (
                    <span className="rounded-full border border-amber-800 bg-amber-900/30 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                      {t(`finance.reason.${o.reason}`)}
                    </span>
                  )}
                  <Money cents={o.amountCents} currency={currency} className="tabular-nums text-neutral-100" />
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-neutral-500">{t('finance.salary.previewNote')}</p>
        </div>
      )}
    </fieldset>
  );
}
