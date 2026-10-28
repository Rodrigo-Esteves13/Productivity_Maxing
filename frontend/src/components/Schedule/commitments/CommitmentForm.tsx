import { useState } from 'react';
import type { FormEvent } from 'react';
import Input from '../../UI/Input';
import ActionButton from '../../UI/ActionButton';
import ErrorState from '../../UI/ErrorState';
import ToggleChip from '../../UI/ToggleChip';
import { WEEKDAYS } from './shiftText';
import AddressTravelFields from './AddressTravelFields';
import type { CommitmentInput } from '../../../api/commitmentsService';
import { useI18n } from '../../../i18n/useI18n';
import type { Commitment, CommuteMode, ContractType } from '../../../types/models';

const MAX_NAME_LENGTH = 80;
const MAX_COMMUTE_MINUTES = 240;
const DEFAULT_COMMUTE = '20';
// Tem de haver pelo menos um dia de trabalho possivel (igual ao backend).
const MAX_DAYS_OFF = 6;

// '' = nao e um trabalho (ou nao interessa dizer).
const CONTRACT_OPTIONS: ('' | ContractType)[] = ['', 'PERMANENT', 'FIXED_TERM', 'INTERNSHIP'];
const CONTRACT_LABEL_KEYS = {
  '': 'commitment.contract.none',
  PERMANENT: 'commitment.contract.permanent',
  FIXED_TERM: 'commitment.contract.fixedTerm',
  INTERNSHIP: 'commitment.contract.internship',
} as const;

// Tudo o que o formulario devolve, no formato que a API aceita.
export type CommitmentFormValues = Required<CommitmentInput>;

interface CommitmentFormProps {
  /** Local existente a editar; sem isto o formulario abre em branco. */
  initial?: Pick<
    Commitment,
    'name' | 'commuteMinutes' | 'daysOff' | 'address' | 'commuteMode' | 'contractType' | 'endsOn'
  >;
  submitLabel: string;
  isSaving: boolean;
  onSubmit: (values: CommitmentFormValues) => Promise<boolean>;
  onCancel: () => void;
}

export default function CommitmentForm({ initial, submitLabel, isSaving, onSubmit, onCancel }: CommitmentFormProps) {
  const { t } = useI18n();
  const [name, setName] = useState(initial?.name ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [mode, setMode] = useState<CommuteMode>(initial?.commuteMode ?? 'TRANSIT');
  const [commute, setCommute] = useState(
    initial === undefined ? DEFAULT_COMMUTE : String(initial.commuteMinutes),
  );
  const [daysOff, setDaysOff] = useState<number[]>(initial?.daysOff ?? []);
  const [contract, setContract] = useState<'' | ContractType>(initial?.contractType ?? '');
  const [endsOn, setEndsOn] = useState(initial?.endsOn?.slice(0, 10) ?? '');
  const [formError, setFormError] = useState('');
  // Contrato a prazo e estagio acabam num dia: a data final e obrigatoria.
  const needsEndDate = contract === 'FIXED_TERM' || contract === 'INTERNSHIP';

  const toggleDayOff = (value: number) =>
    setDaysOff((prev) => (prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value]));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const commuteMinutes = Number(commute);

    if (!name.trim()) {
      setFormError(t('commitment.form.giveName'));
      return;
    }
    if (!Number.isInteger(commuteMinutes) || commuteMinutes < 0 || commuteMinutes > MAX_COMMUTE_MINUTES) {
      setFormError(t('commitment.form.travelRange', { max: MAX_COMMUTE_MINUTES }));
      return;
    }
    if (daysOff.length > MAX_DAYS_OFF) {
      setFormError(t('commitment.form.keepOneDay'));
      return;
    }

    if (needsEndDate && !endsOn) {
      setFormError(t('commitment.contract.endRequired'));
      return;
    }

    setFormError('');
    await onSubmit({
      contractType: contract || null,
      endsOn: contract && endsOn ? endsOn : null,
      name: name.trim(),
      commuteMinutes,
      daysOff,
      address: address.trim(),
      commuteMode: mode,
    });
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3 rounded-lg bg-neutral-800/40 p-3">
      <Input
        label={t('commitment.form.name')}
        value={name}
        maxLength={MAX_NAME_LENGTH}
        placeholder={t('commitment.form.namePlaceholder')}
        onChange={(e) => setName(e.target.value)}
      />
      <fieldset>
        <legend className="block text-sm font-medium text-neutral-300 mb-1">{t('commitment.contract.label')}</legend>
        <div className="flex flex-wrap gap-1.5">
          {CONTRACT_OPTIONS.map((option) => (
            <ToggleChip key={option || 'none'} size="sm" pressed={contract === option} onClick={() => setContract(option)}>
              {t(CONTRACT_LABEL_KEYS[option])}
            </ToggleChip>
          ))}
        </div>
      </fieldset>
      {contract && (
        <Input
          label={needsEndDate ? t('commitment.contract.endsOn') : t('commitment.contract.endsOnOptional')}
          type="date"
          value={endsOn}
          onChange={(e) => setEndsOn(e.target.value)}
        />
      )}
      <AddressTravelFields
        address={address}
        onAddressChange={setAddress}
        mode={mode}
        onModeChange={setMode}
        onEstimated={(minutes) => setCommute(String(minutes))}
      />
      <Input
        label={t('commitment.form.travel')}
        type="number"
        min={0}
        max={MAX_COMMUTE_MINUTES}
        value={commute}
        onChange={(e) => setCommute(e.target.value)}
      />
      <fieldset>
        <legend className="block text-sm font-medium text-neutral-300 mb-1">{t('commitment.form.daysOff')}</legend>
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAYS.map((d) => (
            <ToggleChip
              key={d.value}
              size="sm"
              pressed={daysOff.includes(d.value)}
              disabled={!daysOff.includes(d.value) && daysOff.length >= MAX_DAYS_OFF}
              onClick={() => toggleDayOff(d.value)}
            >
              {d.label}
            </ToggleChip>
          ))}
        </div>
        <p className="mt-1 text-xs text-neutral-500">{t('commitment.form.daysOffHelp')}</p>
      </fieldset>
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
