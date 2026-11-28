import { useRef, useState, type FormEvent } from 'react';
import Modal from '../UI/Modal';
import Input from '../UI/Input';
import Button from '../UI/Button';
import ErrorState from '../UI/ErrorState';
import { useI18n } from '../../i18n/useI18n';
import type { MedicationIntakeChanges } from '../../api/wellbeingService';
import type { MedicationIntake } from '../../types/models';

// Iguais aos limites do backend (wellbeing.constants.ts).
const MAX_DOSE_LENGTH = 60;
const MAX_NOTE_LENGTH = 200;
const MS_PER_MINUTE = 60_000;
// "AAAA-MM-DDTHH:mm", o formato do datetime-local.
const INPUT_LENGTH = 16;

interface IntakeEditModalProps {
  intake: MedicationIntake | null;
  isSaving: boolean;
  onSubmit: (id: string, changes: MedicationIntakeChanges) => Promise<boolean>;
  onClose: () => void;
}

function localInputValue(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * MS_PER_MINUTE).toISOString().slice(0, INPUT_LENGTH);
}

function EditForm({ intake, isSaving, onSubmit, onClose }: IntakeEditModalProps & { intake: MedicationIntake }) {
  const { t } = useI18n();
  const initialTime = localInputValue(new Date(intake.takenAt));
  const [takenAt, setTakenAt] = useState(initialTime);
  const [dose, setDose] = useState(intake.dose ?? '');
  const [note, setNote] = useState(intake.note ?? '');
  const [formError, setFormError] = useState('');
  const busy = useRef(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy.current) return;
    const at = new Date(takenAt);
    if (Number.isNaN(at.getTime())) {
      setFormError(t('wellbeing.meds.intake.timeInvalid'));
      return;
    }
    setFormError('');
    busy.current = true;
    // So manda a hora se mudou: reenviar uma hora antiga falharia a regra dos 30 dias.
    const ok = await onSubmit(intake.id, {
      ...(takenAt !== initialTime && { takenAt: at.toISOString() }),
      dose: dose.trim(),
      note: note.trim(),
    }).finally(() => {
      busy.current = false;
    });
    if (!ok) setFormError(t('ux4well.intake.editError'));
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
      <Input
        type="datetime-local"
        label={t('wellbeing.meds.intake.when')}
        value={takenAt}
        max={localInputValue(new Date())}
        onChange={(e) => setTakenAt(e.target.value)}
      />
      <Input
        label={t('wellbeing.meds.dosage')}
        value={dose}
        maxLength={MAX_DOSE_LENGTH}
        placeholder={t('wellbeing.meds.dosagePlaceholder')}
        onChange={(e) => setDose(e.target.value)}
      />
      <Input
        label={t('wellbeing.meds.intake.note')}
        value={note}
        maxLength={MAX_NOTE_LENGTH}
        onChange={(e) => setNote(e.target.value)}
      />
      {formError && <ErrorState message={formError} />}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" size="sm" disabled={isSaving}>
          {isSaving ? t('common.saving') : t('common.save')}
        </Button>
      </div>
    </form>
  );
}

// Corrigir hora, dose ou nota de uma toma ja registada (sem apagar e recriar).
export default function IntakeEditModal(props: IntakeEditModalProps) {
  const { t } = useI18n();
  const { intake, onClose } = props;
  // Guarda a ultima toma para o conteudo nao mudar durante a animacao de saida.
  const [shown, setShown] = useState(intake);
  if (intake && intake !== shown) setShown(intake);
  return (
    <Modal
      isOpen={intake !== null}
      onClose={onClose}
      title={t('ux4well.intake.editTitle', { name: shown?.name ?? '' })}
    >
      {shown && <EditForm key={shown.id} {...props} intake={shown} />}
    </Modal>
  );
}
