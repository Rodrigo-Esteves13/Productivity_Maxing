import { useState, type FormEvent } from 'react';
import Modal from '../UI/Modal';
import Input from '../UI/Input';
import Select from '../UI/Select';
import Button from '../UI/Button';
import FormError from '../UI/FormError';
import { useI18n } from '../../i18n/useI18n';
import type { BloodDonationChanges } from '../../api/wellbeingService';
import type { BloodDonation, BloodDonationType } from '../../types/models';

// Iguais aos limites do backend (wellbeing.constants.ts).
const LOCATION_MAX_LENGTH = 120;
const NOTE_MAX_LENGTH = 300;

export interface BloodTypeOption {
  value: BloodDonationType;
  labelKey: string;
}

interface BloodDonationEditModalProps {
  donation: BloodDonation | null;
  types: BloodTypeOption[];
  today: string;
  isBusy: boolean;
  error: string;
  onSubmit: (id: string, changes: BloodDonationChanges) => Promise<void>;
  onClose: () => void;
}

function EditForm({
  donation,
  types,
  today,
  isBusy,
  error,
  onSubmit,
  onClose,
}: BloodDonationEditModalProps & { donation: BloodDonation }) {
  const { t } = useI18n();
  const [date, setDate] = useState(donation.date.slice(0, 10));
  const [type, setType] = useState<BloodDonationType>(donation.type);
  const [location, setLocation] = useState(donation.location ?? '');
  const [note, setNote] = useState(donation.note ?? '');

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    // Texto vazio apaga o campo no backend.
    void onSubmit(donation.id, { date, type, location: location.trim(), note: note.trim() });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Input
          type="date"
          required
          max={today}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label={t('wellbeing.blood.date')}
        />
        <Select
          value={type}
          onChange={(e) => setType(e.target.value as BloodDonationType)}
          aria-label={t('wellbeing.blood.typeLabel')}
        >
          {types.map((option) => (
            <option key={option.value} value={option.value}>
              {t(option.labelKey)}
            </option>
          ))}
        </Select>
      </div>
      <Input
        value={location}
        maxLength={LOCATION_MAX_LENGTH}
        onChange={(e) => setLocation(e.target.value)}
        placeholder={t('wellbeing.blood.location')}
        aria-label={t('wellbeing.blood.location')}
      />
      <Input
        value={note}
        maxLength={NOTE_MAX_LENGTH}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t('ux4well.blood.note')}
        aria-label={t('ux4well.blood.note')}
      />
      {error && <FormError message={error} />}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" size="sm" disabled={isBusy || !date}>
          {isBusy ? t('common.saving') : t('common.save')}
        </Button>
      </div>
    </form>
  );
}

// Corrigir uma dadiva ja registada (data, tipo, local, nota) sem apagar e recriar.
export default function BloodDonationEditModal(props: BloodDonationEditModalProps) {
  const { t } = useI18n();
  const { donation, onClose } = props;
  // Guarda a ultima dadiva para o conteudo nao mudar durante a animacao de saida.
  const [shown, setShown] = useState(donation);
  if (donation && donation !== shown) setShown(donation);
  return (
    <Modal isOpen={donation !== null} onClose={onClose} title={t('ux4well.blood.editTitle')}>
      {shown && <EditForm key={shown.id} {...props} donation={shown} />}
    </Modal>
  );
}
