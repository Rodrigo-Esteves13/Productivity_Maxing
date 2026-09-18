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

interface CommuteSettingsCardProps {
  user: User;
  onUserUpdate: (user: User) => void;
}

// Nem todo o estudante tem carro - estas são as opções que a Distance
// Matrix API aceita (ver ScheduleService.estimateCommute).
const COMMUTE_MODE_OPTIONS: { value: CommuteMode; label: string }[] = [
  { value: 'WALKING', label: 'Walking' },
  { value: 'TRANSIT', label: 'Public transit' },
  { value: 'BICYCLING', label: 'Bicycle' },
  { value: 'DRIVING', label: 'Car' },
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
      setError('Fill in both addresses first.');
      return;
    }

    setIsEstimating(true);
    try {
      const result = await estimateCommute(homeAddress.trim(), campusAddress.trim(), commuteMode);
      setCommuteMinutes(String(result.commuteMinutes));
      onUserUpdate({ ...user, ...result });
      setSuccessMessage(`Estimated at ${result.commuteMinutes} min - saved.`);
    } catch (err) {
      console.error('Failed to estimate commute:', err);
      setError(
        "Couldn't calculate a route between those addresses (or automatic estimation isn't configured on this server). You can still set the commute time manually below.",
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
      setError('Commute time must be a positive number of minutes.');
      return;
    }

    const startMinutes = timeValueToMinutes(quietHoursStart);
    const endMinutes = timeValueToMinutes(quietHoursEnd);
    if ((startMinutes == null) !== (endMinutes == null)) {
      setError('Set both quiet hours fields, or leave both empty.');
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
      setError('Could not save your changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6 max-w-3xl mt-8">
      <h2 className="text-lg font-semibold text-white mb-1">Commute &amp; quiet hours</h2>
      <p className="text-sm text-neutral-400 mb-4">
        Used by the study plan to avoid suggesting sessions while you're in transit or asleep.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Home address" htmlFor="commute-home">
            <Input
              id="commute-home"
              value={homeAddress}
              onChange={(e) => setHomeAddress(e.target.value)}
              placeholder="Street, city"
            />
          </FormField>
          <FormField label="Campus address" htmlFor="commute-campus">
            <Input
              id="commute-campus"
              value={campusAddress}
              onChange={(e) => setCampusAddress(e.target.value)}
              placeholder="Institution, city"
            />
          </FormField>
        </div>

        <FormField label="How do you get to campus?" htmlFor="commute-mode">
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
            {isEstimating ? 'Calculating...' : 'Calculate automatically'}
          </Button>
          <p className="text-xs text-neutral-500">
            Fills in the commute time below from the two addresses above, using the mode selected.
          </p>
        </div>

        <FormField label="Commute time (minutes, one-way)" htmlFor="commute-minutes">
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
          <FormField label="Quiet hours start (e.g. bedtime)" htmlFor="quiet-start">
            <Input
              id="quiet-start"
              type="time"
              value={quietHoursStart}
              onChange={(e) => setQuietHoursStart(e.target.value)}
            />
          </FormField>
          <FormField label="Quiet hours end (e.g. wake up)" htmlFor="quiet-end">
            <Input
              id="quiet-end"
              type="time"
              value={quietHoursEnd}
              onChange={(e) => setQuietHoursEnd(e.target.value)}
            />
          </FormField>
        </div>

        {error && <FormError message={error} />}
        {successMessage && !error && <p className="text-sm text-emerald-400">{successMessage}</p>}

        <div className="flex justify-end">
          <ActionButton type="submit" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save settings'}
          </ActionButton>
        </div>
      </form>
    </div>
  );
}
