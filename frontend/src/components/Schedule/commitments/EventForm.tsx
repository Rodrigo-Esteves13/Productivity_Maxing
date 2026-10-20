import { useState } from 'react';
import type { FormEvent } from 'react';
import Input from '../../UI/Input';
import ActionButton from '../../UI/ActionButton';
import ErrorState from '../../UI/ErrorState';
import { parseClock } from '../../../lib/timeFormat';
import { toDateKey } from '../../../lib/dateKey';
import { todayUtcAnchored } from '../../../lib/weekDates';
import type { CommuteMode, CreateWorkShiftInput } from '../../../types/models';
import AddressTravelFields from './AddressTravelFields';
import { useI18n } from '../../../i18n/useI18n';

const MAX_TITLE_LENGTH = 80;
const MAX_TRAVEL_MINUTES = 240;
const DEFAULT_START = '10:00';
const DEFAULT_END = '11:00';
const DEFAULT_TRAVEL = '0';
const DEFAULT_MODE: CommuteMode = 'TRANSIT';

interface EventFormProps {
  isSaving: boolean;
  onSubmit: (input: CreateWorkShiftInput) => Promise<boolean>;
  onCancel: () => void;
}

// Evento unico sem categoria (ir ao medico, uma entrevista...): so precisa
// de um titulo, um dia e as horas. Guarda-se como um turno pontual sem
// local, e sai da lista sozinho depois do dia. A morada (opcional) calcula a
// viagem casa-evento e deixa o itinerario do dia ir direto de/para as aulas
// ou o trabalho quando nao ha tempo de passar por casa.
export default function EventForm({ isSaving, onSubmit, onCancel }: EventFormProps) {
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(toDateKey(todayUtcAnchored()));
  const [start, setStart] = useState(DEFAULT_START);
  const [end, setEnd] = useState(DEFAULT_END);
  const [travel, setTravel] = useState(DEFAULT_TRAVEL);
  const [address, setAddress] = useState('');
  const [mode, setMode] = useState<CommuteMode>(DEFAULT_MODE);
  const [formError, setFormError] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const startMinutes = parseClock(start);
    const endMinutes = parseClock(end);
    const bufferMinutes = Number(travel);

    if (!title.trim()) return setFormError(t('ui.giveTheEventATitle'));
    if (!date) return setFormError(t('ui.pickADate'));
    if (startMinutes === null || endMinutes === null || startMinutes >= endMinutes) {
      return setFormError(t('ui.startMustBeBeforeEnd'));
    }
    if (!Number.isInteger(bufferMinutes) || bufferMinutes < 0 || bufferMinutes > MAX_TRAVEL_MINUTES) {
      return setFormError(t('ui.travelTimeRange', { max: MAX_TRAVEL_MINUTES }));
    }

    setFormError('');
    await onSubmit({
      label: title.trim(),
      date,
      startMinutes,
      endMinutes,
      bufferMinutes,
      ...(address.trim() && { address: address.trim(), commuteMode: mode }),
    });
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3 rounded-lg bg-neutral-800/40 p-3">
      <Input
        label={t('ui.title')}
        value={title}
        maxLength={MAX_TITLE_LENGTH}
        placeholder={t('ui.doctorJobInterview')}
        onChange={(e) => setTitle(e.target.value)}
      />
      <Input label={t('ui.date')} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Input label={t('ui.from')} type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        <Input label={t('ui.to')} type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
        <Input
          label={t('ui.travelEachWayMin')}
          type="number"
          min={0}
          max={MAX_TRAVEL_MINUTES}
          value={travel}
          onChange={(e) => setTravel(e.target.value)}
        />
      </div>
      <AddressTravelFields
        address={address}
        onAddressChange={setAddress}
        mode={mode}
        onModeChange={setMode}
        onEstimated={(minutes) => setTravel(String(minutes))}
      />
      {formError && <ErrorState message={formError} />}
      <div className="flex gap-2">
        <ActionButton type="submit" disabled={isSaving}>
          {isSaving ? t('common.saving') : t('ui.addEvent')}
        </ActionButton>
        <button type="button" onClick={onCancel} className="px-3 py-2 text-sm text-neutral-400 hover:text-white">
          {t('ui.cancel')}
        </button>
      </div>
    </form>
  );
}
