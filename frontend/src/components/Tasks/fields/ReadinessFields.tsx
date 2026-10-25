import FormField from '../../UI/FormField';
import Input from '../../UI/Input';
import Select from '../../UI/Select';
import { useEnumLabel } from '../../../hooks/useEnumLabel';
import { useI18n } from '../../../i18n/useI18n';
import { DATE_CERTAINTIES, EFFORTS } from '../../../lib/taskReadiness';

interface ReadinessFieldsProps {
  idPrefix: string;
  effort: string;
  dateCertainty: string;
  isBlocked: boolean;
  availableFrom: string;
  onEffortChange: (value: string) => void;
  onDateCertaintyChange: (value: string) => void;
  onIsBlockedChange: (value: boolean) => void;
  onAvailableFromChange: (value: string) => void;
}

// Tres coisas que a dificuldade e a data sozinhas nao dizem: quanto trabalho
// a task da (facil mas exaustiva), se a data ja esta mesmo marcada, e se ja
// da para comecar. As tres mexem no plano de estudo e nos atrasos (ver
// Effort/DateCertainty/isBlocked no schema.prisma).
export default function ReadinessFields({
  idPrefix,
  effort,
  dateCertainty,
  isBlocked,
  availableFrom,
  onEffortChange,
  onDateCertaintyChange,
  onIsBlockedChange,
  onAvailableFromChange,
}: ReadinessFieldsProps) {
  const { t } = useI18n();
  const enumLabel = useEnumLabel();
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label={t('readiness.effort')} htmlFor={`${idPrefix}-effort`}>
          <Select
            id={`${idPrefix}-effort`}
            value={effort}
            onChange={(e) => onEffortChange(e.target.value)}
            className="w-full"
          >
            <option value="">{t('readiness.effortNotSet')}</option>
            {EFFORTS.map((value) => (
              <option key={value} value={value}>
                {enumLabel(value)}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-neutral-500">{t('readiness.effortHelp')}</p>
        </FormField>
        <FormField label={t('readiness.dateCertainty')} htmlFor={`${idPrefix}-date-certainty`}>
          <Select
            id={`${idPrefix}-date-certainty`}
            value={dateCertainty}
            onChange={(e) => onDateCertaintyChange(e.target.value)}
            className="w-full"
          >
            {DATE_CERTAINTIES.map((value) => (
              <option key={value} value={value}>
                {enumLabel(value)}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-neutral-500">{t(`readiness.dateHelp.${dateCertainty}`)}</p>
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
        <FormField label={t('readiness.availableFrom')} htmlFor={`${idPrefix}-available-from`}>
          <Input
            id={`${idPrefix}-available-from`}
            type="date"
            value={availableFrom}
            onChange={(e) => onAvailableFromChange(e.target.value)}
            className="w-full"
          />
          <p className="mt-1 text-xs text-neutral-500">{t('readiness.availableFromHelp')}</p>
        </FormField>
        <label className="flex items-start gap-2 text-sm text-neutral-300 select-none cursor-pointer sm:mt-7">
          <input
            type="checkbox"
            checked={isBlocked}
            onChange={(e) => onIsBlockedChange(e.target.checked)}
            className="mt-0.5 accent-violet-500"
          />
          <span>
            <span className="block">{t('readiness.blocked')}</span>
            <span className="block text-xs text-neutral-500">{t('readiness.blockedHelp')}</span>
          </span>
        </label>
      </div>
    </div>
  );
}
