import { useState, type FormEvent } from 'react';
import Modal from '../UI/Modal';
import Input from '../UI/Input';
import Button from '../UI/Button';
import ErrorState from '../UI/ErrorState';
import { useI18n } from '../../i18n/useI18n';
import type { Medication, MedicationIntakeInput } from '../../types/models';

// Iguais aos limites do backend (wellbeing.constants.ts).
const MAX_DOSE_LENGTH = 60;
const MAX_NOTE_LENGTH = 200;
const MS_PER_MINUTE = 60_000;

interface IntakeLogModalProps {
  medication: Medication | null;
  isSaving: boolean;
  onSubmit: (input: MedicationIntakeInput) => Promise<boolean>;
  onClose: () => void;
}

// Valor para <input type="datetime-local"> na hora local do browser.
function localInputValue(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * MS_PER_MINUTE).toISOString().slice(0, 16);
}

function IntakeForm({ medication, isSaving, onSubmit, onClose }: IntakeLogModalProps & { medication: Medication }) {
  const { t } = useI18n();
  const [takenAt, setTakenAt] = useState(() => localInputValue(new Date()));
  const [dose, setDose] = useState(medication.dosage ?? '');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const at = new Date(takenAt);
    if (Number.isNaN(at.getTime())) {
      setFormError(t('wellbeing.meds.intake.timeInvalid'));
      return;
    }
    setFormError('');
    const ok = await onSubmit({
      medicationId: medication.id,
      takenAt: at.toISOString(),
      dose: dose.trim() || undefined,
      note: note.trim() || undefined,
    });
    if (!ok) setFormError(t('wellbeing.meds.intake.saveError'));
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
      <p className="rounded-md border border-amber-900/50 bg-amber-950/20 px-3 py-2 text-xs text-amber-300">
        {t('wellbeing.meds.generalCaution')}
      </p>
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
      <p className="text-xs font-medium text-amber-300">{t('wellbeing.meds.alwaysAskDoctor')}</p>
      <p className="text-xs text-neutral-400">{t('wellbeing.meds.intake.onlyRecord')}</p>
      <p className="text-xs text-neutral-500">{t('wellbeing.meds.legal')}</p>
      {formError && <ErrorState message={formError} />}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" size="sm" disabled={isSaving}>
          {isSaving ? t('common.saving') : t('wellbeing.meds.intake.log')}
        </Button>
      </div>
    </form>
  );
}

// Registar uma toma "se necessario". So guarda o registo: a app nao avalia
// se a toma e segura.
export default function IntakeLogModal(props: IntakeLogModalProps) {
  const { t } = useI18n();
  const { medication, onClose } = props;
  // Guarda o ultimo medicamento para o conteudo nao mudar durante a animacao
  // de saida; openId muda a cada abertura para o formulario recomecar.
  const [shown, setShown] = useState(medication);
  const [openId, setOpenId] = useState(0);
  if (medication && medication !== shown) {
    setShown(medication);
    setOpenId((n) => n + 1);
  }
  return (
    <Modal
      isOpen={medication !== null}
      onClose={onClose}
      title={t('wellbeing.meds.intake.titleMedication', { name: shown?.name ?? '' })}
    >
      {shown && <IntakeForm key={openId} {...props} medication={shown} />}
    </Modal>
  );
}
