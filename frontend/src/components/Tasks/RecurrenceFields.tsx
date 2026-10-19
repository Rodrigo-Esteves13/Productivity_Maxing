import { RECURRENCE_UNIT, type RecurrenceValue } from '../../lib/recurrence';
import { useI18n } from '../../i18n/useI18n';

interface RecurrenceFieldsProps {
  idPrefix: string;
  value: RecurrenceValue;
  onChange: (value: RecurrenceValue) => void;
}

// "Repetir": ao concluir a task cria-se a proxima ocorrencia.
export default function RecurrenceFields({ idPrefix, value, onChange }: RecurrenceFieldsProps) {
  const { t } = useI18n();
  const inputClass =
    'rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-violet-600';

  return (
    <div className="space-y-2">
      <label htmlFor={`${idPrefix}-repeat`} className="block text-sm font-medium text-neutral-300">
        {t('ui.repeat')} <span className="text-neutral-500 font-normal">{t('ui.theNextOneIsCreated')}</span>
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <select
          id={`${idPrefix}-repeat`}
          value={value.frequency}
          onChange={(e) => onChange({ ...value, frequency: e.target.value as RecurrenceValue['frequency'] })}
          className={inputClass}
        >
          <option value="">{t('ui.doesNotRepeat')}</option>
          <option value="DAILY">{t('ui.daily')}</option>
          <option value="WEEKLY">{t('ui.weekly')}</option>
          <option value="MONTHLY">{t('ui.monthly')}</option>
        </select>
        {value.frequency && (
          <>
            <span className="text-sm text-neutral-400">{t('ui.everyLower')}</span>
            <input
              type="number"
              min={1}
              max={365}
              value={value.interval}
              onChange={(e) => onChange({ ...value, interval: e.target.value })}
              aria-label={t('ui.repeatInterval')}
              className={`${inputClass} w-20`}
            />
            <span className="text-sm text-neutral-400">{t('ui.until', { frequency: RECURRENCE_UNIT[value.frequency] })}</span>
            <input
              type="date"
              value={value.until}
              onChange={(e) => onChange({ ...value, until: e.target.value })}
              aria-label={t('ui.repeatUntilOptional')}
              className={inputClass}
            />
          </>
        )}
      </div>
    </div>
  );
}
