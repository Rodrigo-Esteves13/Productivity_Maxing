import { useEffect, useState, type SyntheticEvent } from 'react';
import FormField from '../UI/FormField';
import Input from '../UI/Input';
import Select from '../UI/Select';
import FormError from '../UI/FormError';
import ActionButton from '../UI/ActionButton';
import Button from '../UI/Button';
import { updateUserProfile } from '../../api/userService';
import { estimateCommute } from '../../api/scheduleService';
import type { CommuteMode, User } from '../../types/models';
import { useI18n } from '../../i18n/useI18n';
import { translateNow } from '../../i18n/translate';
import Card from '../UI/Card';

interface CommuteSettingsCardProps {
  user: User;
  onUserUpdate: (user: User) => void;
}

// Nem todo o estudante tem carro - estas são as opções que a Distance
// Matrix API aceita (ver ScheduleService.estimateCommute).
const COMMUTE_MODE_OPTIONS: { value: CommuteMode; label: string }[] = [
  { value: 'WALKING', get label() { return translateNow('ui.commuteWalking'); } },
  { value: 'TRANSIT', get label() { return translateNow('ui.commuteTransit'); } },
  { value: 'BICYCLING', get label() { return translateNow('ui.commuteBicycle'); } },
  { value: 'DRIVING', get label() { return translateNow('ui.commuteCar'); } },
];

// "480" -> "08:00", para popular um <input type="time">. Sem valor
// (null/undefined) -> string vazia, o time-picker fica em branco.
function minutesToTimeValue(minutes: number | null): string {
  if (minutes == null) return '';
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

// "08:00" -> 480. String vazia -> null (utilizador limpou o campo).
function timeValueToMinutes(value: string): number | null {
  if (!value) return null;
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

export default function CommuteSettingsCard({ user, onUserUpdate }: CommuteSettingsCardProps) {
  const { t } = useI18n();
  const [commuteMinutes, setCommuteMinutes] = useState(
    user.commuteMinutes != null ? String(user.commuteMinutes) : '',
  );
  const [commuteMode, setCommuteMode] = useState<CommuteMode>(user.commuteMode);
  const [homeAddress, setHomeAddress] = useState(user.homeAddress ?? '');
  const [campusAddress, setCampusAddress] = useState(user.campusAddress ?? '');
  const [quietHoursStart, setQuietHoursStart] = useState(
    minutesToTimeValue(user.quietHoursStart),
  );
  const [quietHoursEnd, setQuietHoursEnd] = useState(minutesToTimeValue(user.quietHoursEnd));

  const [isSaving, setIsSaving] = useState(false);
  const [isEstimating, setIsEstimating] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Se o user global mudar por fora (outro separador, outro componente),
  // repõe os campos - mesma lógica do useEffect em EditProfileModal.
  useEffect(() => {
    setCommuteMinutes(user.commuteMinutes != null ? String(user.commuteMinutes) : '');
    setCommuteMode(user.commuteMode);
    setHomeAddress(user.homeAddress ?? '');
    setCampusAddress(user.campusAddress ?? '');
    setQuietHoursStart(minutesToTimeValue(user.quietHoursStart));
    setQuietHoursEnd(minutesToTimeValue(user.quietHoursEnd));
  }, [user]);

  const handleEstimate = async () => {
    setError('');
    setSuccessMessage('');
    if (!homeAddress.trim() || !campusAddress.trim()) {
      setError(t('ui.fillInBothAddressesFirst'));
      return;
    }

    setIsEstimating(true);
    try {
      const result = await estimateCommute(homeAddress.trim(), campusAddress.trim(), commuteMode);
      setCommuteMinutes(String(result.commuteMinutes));
      onUserUpdate({ ...user, ...result });
      setSuccessMessage(t('ui.commuteEstimatedSaved', { count: result.commuteMinutes }));
    } catch (err) {
      console.error('Failed to estimate commute:', err);
      setError(
        t('ui.couldntCalculateARouteBetween'),
      );
    } finally {
      setIsEstimating(false);
    }
  };

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    const parsedCommute = commuteMinutes.trim() ? Number(commuteMinutes) : undefined;
    if (parsedCommute !== undefined && (Number.isNaN(parsedCommute) || parsedCommute < 0)) {
      setError(t('ui.commuteTimeMustBeA'));
      return;
    }

    const startMinutes = timeValueToMinutes(quietHoursStart);
    const endMinutes = timeValueToMinutes(quietHoursEnd);
    if ((startMinutes == null) !== (endMinutes == null)) {
      setError(t('ui.setBothQuietHoursFields'));
      return;
    }

    setIsSaving(true);
    try {
      const updated = await updateUserProfile({
        commuteMinutes: parsedCommute,
        commuteMode,
        homeAddress: homeAddress.trim() || undefined,
        campusAddress: campusAddress.trim() || undefined,
        ...(startMinutes != null && endMinutes != null
          ? { quietHoursStart: startMinutes, quietHoursEnd: endMinutes }
          : {}),
      });
      onUserUpdate(updated);
      setSuccessMessage('Saved.');
    } catch (err) {
      console.error('Failed to save schedule settings:', err);
      setError(t('ui.couldNotSaveYourChanges'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <h2 className="text-lg font-semibold text-white mb-1">{t('ui.commuteQuietHours')}</h2>
      <p className="text-sm text-neutral-400 mb-4">
        {t('ui.usedByTheStudyPlan')}
      </p>
      <p className="text-xs text-neutral-500 mb-4">{t('ui.itineraryExplained')}</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label={t('ui.homeAddress')} htmlFor="commute-home">
            <Input
              id="commute-home"
              value={homeAddress}
              onChange={(e) => setHomeAddress(e.target.value)}
              placeholder={t('ui.streetCity')}
            />
          </FormField>
          <FormField label={t('ui.campusAddress')} htmlFor="commute-campus">
            <Input
              id="commute-campus"
              value={campusAddress}
              onChange={(e) => setCampusAddress(e.target.value)}
              placeholder={t('ui.institutionCity')}
            />
          </FormField>
        </div>

        <FormField label={t('ui.howDoYouGetTo')} htmlFor="commute-mode">
          <Select
            id="commute-mode"
            value={commuteMode}
            onChange={(e) => setCommuteMode(e.target.value as CommuteMode)}
            className="max-w-[12rem]"
          >
            {COMMUTE_MODE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </FormField>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={handleEstimate}
            disabled={isEstimating}
            className="w-auto px-3 py-2 text-sm"
          >
            {isEstimating ? t('commitment.form.calculating') : t('ui.calculateAutomatically')}
          </Button>
          <p className="text-xs text-neutral-500">
            {t('ui.fillsInTheCommuteTime')}
          </p>
        </div>

        <FormField label={t('ui.commuteTimeMinutesOneWay')} htmlFor="commute-minutes">
          <Input
            id="commute-minutes"
            type="number"
            min={0}
            max={300}
            value={commuteMinutes}
            onChange={(e) => setCommuteMinutes(e.target.value)}
            placeholder="e.g. 25"
            className="max-w-[10rem]"
          />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label={t('ui.quietHoursStartEG')} htmlFor="quiet-start">
            <Input
              id="quiet-start"
              type="time"
              value={quietHoursStart}
              onChange={(e) => setQuietHoursStart(e.target.value)}
            />
          </FormField>
          <FormField label={t('ui.quietHoursEndEG')} htmlFor="quiet-end">
            <Input
              id="quiet-end"
              type="time"
              value={quietHoursEnd}
              onChange={(e) => setQuietHoursEnd(e.target.value)}
            />
          </FormField>
        </div>

        {error && <FormError message={error} />}
        {successMessage && !error && <p className="text-sm text-violet-300">{successMessage}</p>}

        <div className="flex justify-end">
          <ActionButton type="submit" disabled={isSaving}>
            {isSaving ? t('common.saving') : t('ui.saveSettings')}
          </ActionButton>
        </div>
      </form>
    </Card>
  );
}
