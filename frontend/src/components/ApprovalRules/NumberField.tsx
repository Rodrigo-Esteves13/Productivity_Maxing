import FormField from '../UI/FormField';
import Input from '../UI/Input';
import { useI18n } from '../../i18n/useI18n';

interface NumberFieldProps {
  id: string;
  label: string;
  help?: string;
  value: string;
  error?: string;
  errorParams?: Record<string, string | number>;
  optional?: boolean;
  onChange: (value: string) => void;
}

export default function NumberField({ id, label, help, value, error, errorParams, onChange }: NumberFieldProps) {
  const { t } = useI18n();
  const describedBy = [help ? `${id}-help` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(' ');
  return (
    <FormField label={label} htmlFor={id}>
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={error ? 'border-red-700' : ''}
      />
      {help && (
        <p id={`${id}-help`} className="mt-1 text-xs text-neutral-500">
          {help}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-red-400">
          {t(error, errorParams)}
        </p>
      )}
    </FormField>
  );
}
