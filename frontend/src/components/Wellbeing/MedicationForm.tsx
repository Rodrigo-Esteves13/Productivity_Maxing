import { useState, type FormEvent } from 'react';
import Input from '../UI/Input';
import ActionButton from '../UI/ActionButton';
import ErrorState from '../UI/ErrorState';
import IconButton from '../UI/IconButton';
import ToggleRow from '../UI/ToggleRow';
import SegmentedControl from '../UI/SegmentedControl';
import { PlusIcon, XIcon } from '../UI/Icons';
import { formatClock, parseClock } from '../../lib/timeFormat';
import { deviceMatchesAppTimeZone } from '../../lib/appTimeZone';
import { useI18n } from '../../i18n/useI18n';
import type { Medication, MedicationInput, MedicationSchedule } from '../../types/models';

const DEFAULT_TIME = '08:00';
// Iguais aos limites do backend (wellbeing.constants.ts).
const MAX_TIMES = 8;
const MAX_NAME_LENGTH = 100;
const MAX_DOSAGE_LENGTH = 60;
const SCHEDULES: MedicationSchedule[] = ['DAILY', 'AS_NEEDED'];


interface MedicationFormProps {
  initial?: Medication;
  isSaving: boolean;
  submitLabel: string;
  onSubmit: (input: MedicationInput) => Promise<boolean>;
  onCancel: () => void;
}

export default function MedicationForm({ initial, isSaving, submitLabel, onSubmit, onCancel }: MedicationFormProps) {
  const { t } = useI18n();
  const [name, setName] = useState(initial?.name ?? '');
  const [dosage, setDosage] = useState(initial?.dosage ?? '');
  const [schedule, setSchedule] = useState<MedicationSchedule>(initial?.schedule ?? 'DAILY');
  const [times, setTimes] = useState<string[]>(
    initial && initial.times.length > 0 ? initial.times.map(formatClock) : [DEFAULT_TIME],
  );
  const [remindersEnabled, setRemindersEnabled] = useState(initial?.remindersEnabled ?? true);
  const [formError, setFormError] = useState('');

  const isDaily = schedule === 'DAILY';

  const setTimeAt = (index: number, value: string) =>
    setTimes((prev) => prev.map((time, i) => (i === index ? value : time)));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = times.map(parseClock);
    if (!name.trim()) {
      setFormError(t('wellbeing.meds.nameRequired'));
      return;
    }
    if (isDaily && (parsed.length === 0 || parsed.some((m) => m === null))) {
      setFormError(t('wellbeing.meds.timeInvalid'));
      return;
    }
    setFormError('');
    const ok = await onSubmit({
      name: name.trim(),
      dosage: dosage.trim(),
      schedule,
      times: isDaily ? parsed.filter((m): m is number => m !== null) : [],
      remindersEnabled: isDaily && remindersEnabled,
    });
    if (!ok) setFormError(t('wellbeing.meds.saveError'));
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3 rounded-lg bg-neutral-800/40 p-3">
      <p className="text-xs font-medium text-amber-300">{t('wellbeing.meds.alwaysAskDoctor')}</p>
      <Input label={t('wellbeing.meds.name')} value={name} maxLength={MAX_NAME_LENGTH} onChange={(e) => setName(e.target.value)} />
      <Input
        label={t('wellbeing.meds.dosage')}
        value={dosage}
        maxLength={MAX_DOSAGE_LENGTH}
        placeholder={t('wellbeing.meds.dosagePlaceholder')}
        onChange={(e) => setDosage(e.target.value)}
      />
      <div>
        <p className="mb-1 block text-sm font-medium text-neutral-300">{t('wellbeing.meds.schedule')}</p>
        <SegmentedControl
          options={SCHEDULES.map((value) => ({ value, label: t(`wellbeing.meds.schedule.${value}`) }))}
          value={schedule}
          onChange={setSchedule}
          className="w-fit"
        />
        {!isDaily && <p className="mt-1 text-xs text-neutral-500">{t('wellbeing.meds.schedule.asNeededHelp')}</p>}
      </div>
      {isDaily && (
        <fieldset>
          <legend className="mb-1 block text-sm font-medium text-neutral-300">{t('wellbeing.meds.times')}</legend>
          {/* As horas sao de Lisboa (backend, getLisbonNow): diz-se sempre e
              avisa-se mais forte quando o dispositivo esta noutro fuso. */}
          <p className="mb-2 text-xs text-neutral-500">{t('wellbeing.meds.timesZone')}</p>
          {!deviceMatchesAppTimeZone() && (
            <p className="mb-2 text-xs text-amber-300">{t('wellbeing.meds.timesZoneDiffers')}</p>
          )}
          <div className="space-y-2">
            {times.map((time, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  type="time"
                  aria-label={t('wellbeing.meds.timeN', { n: index + 1 })}
                  value={time}
                  onChange={(e) => setTimeAt(index, e.target.value)}
                />
                {times.length > 1 && (
                  <IconButton
                    label={t('wellbeing.meds.removeTime')}
                    tone="danger"
                    onClick={() => setTimes((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <XIcon className="h-4 w-4" />
                  </IconButton>
                )}
              </div>
            ))}
          </div>
          {times.length < MAX_TIMES && (
            <button
              type="button"
              onClick={() => setTimes((prev) => [...prev, DEFAULT_TIME])}
              className="mt-2 flex items-center gap-1 text-xs font-medium text-violet-400 hover:text-violet-300"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              {t('wellbeing.meds.addTime')}
            </button>
          )}
        </fieldset>
      )}
      {isDaily && (
        <ToggleRow
          variant="inline"
          label={t('wellbeing.meds.reminders')}
          description={t('wellbeing.meds.remindersHelp')}
          checked={remindersEnabled}
          onChange={setRemindersEnabled}
        />
      )}
      {formError && <ErrorState message={formError} />}
      <div className="flex gap-2">
        <ActionButton type="submit" disabled={isSaving}>
          {isSaving ? t('common.saving') : submitLabel}
        </ActionButton>
        <button type="button" onClick={onCancel} className="px-3 py-2 text-sm text-neutral-400 hover:text-white">
          {t('common.cancel')}
        </button>
      </div>
    </form>
  );
}
