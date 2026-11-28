import { useRef, useState, type FormEvent } from 'react';
import Modal from '../UI/Modal';
import Input from '../UI/Input';
import Button from '../UI/Button';
import ErrorState from '../UI/ErrorState';
import ToggleChip from '../UI/ToggleChip';
import { useI18n } from '../../i18n/useI18n';
import type { Medication, MedicationIntakeInput } from '../../types/models';

// Iguais aos limites do backend (wellbeing.constants.ts).
const MAX_DOSE_LENGTH = 60;
const MAX_NOTE_LENGTH = 200;
const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 24 * 60 * MS_PER_MINUTE;
// Tamanho de AAAA-MM-DD no valor do datetime-local.
const DATE_LENGTH = 10;

interface IntakeLogModalProps {
  medication: Medication | null;
  isSaving: boolean;
  // Dia (AAAA-MM-DD) que a lista de tomas ja esta a mostrar: a data por
  // defeito segue-o (ex: ontem), em vez de voltar sempre a hoje.
  defaultDayKey?: string | null;
  // keepOpen: grava e deixa o formulario aberto para registar outra toma.
  onSubmit: (input: MedicationIntakeInput, keepOpen: boolean) => Promise<boolean>;
  onClose: () => void;
}

// Valor para <input type="datetime-local"> na hora local do browser.
function localInputValue(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * MS_PER_MINUTE).toISOString().slice(0, 16);
}

// Hora local atual no dia escolhido; sem dia (ou hoje) e simplesmente agora.
function initialTakenAt(dayKey: string | null | undefined): string {
  const nowValue = localInputValue(new Date());
  return dayKey && dayKey < nowValue.slice(0, DATE_LENGTH) ? `${dayKey}${nowValue.slice(DATE_LENGTH)}` : nowValue;
}

function IntakeForm({
  medication,
  isSaving,
  defaultDayKey,
  onSubmit,
  onClose,
}: IntakeLogModalProps & { medication: Medication }) {
  const { t } = useI18n();
  const [takenAt, setTakenAt] = useState(() => initialTakenAt(defaultDayKey));
  const [loggedCount, setLoggedCount] = useState(0);
  // Impede dois toques seguidos de gravarem a mesma toma duas vezes.
  const busy = useRef(false);
  // Atalhos: o seletor de data e hora e chato no telemovel, e o caso comum
  // e "agora" ou "esqueci-me ontem".
  const now = localInputValue(new Date());
  const yesterday = localInputValue(new Date(Date.now() - MS_PER_DAY));
  const [dose, setDose] = useState(medication.dosage ?? '');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState('');

  const submit = async (keepOpen: boolean) => {
    if (busy.current) return;
    const at = new Date(takenAt);
    if (Number.isNaN(at.getTime())) {
      setFormError(t('wellbeing.meds.intake.timeInvalid'));
      return;
    }
    setFormError('');
    busy.current = true;
    const ok = await onSubmit(
      {
        medicationId: medication.id,
        takenAt: at.toISOString(),
        dose: dose.trim() || undefined,
        note: note.trim() || undefined,
      },
      keepOpen,
    ).finally(() => {
      busy.current = false;
    });
    if (!ok) {
      setFormError(t('wellbeing.meds.intake.saveError'));
    } else if (keepOpen) {
      setLoggedCount((n) => n + 1);
      setNote('');
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submit(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
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
      <div className="flex flex-wrap gap-2" role="group" aria-label={t('wellbeing.meds.intake.when')}>
        <ToggleChip size="sm" pressed={takenAt === now} onClick={() => setTakenAt(now)}>
          {t('wellbeing.meds.intake.now')}
        </ToggleChip>
        <ToggleChip size="sm" pressed={takenAt === yesterday} onClick={() => setTakenAt(yesterday)}>
          {t('wellbeing.meds.intake.yesterdaySameTime')}
        </ToggleChip>
      </div>
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
      {loggedCount > 0 && (
        <p role="status" className="text-xs text-violet-300">
          {t('wellbeing.meds.intake.loggedCount', { count: loggedCount })}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button type="button" variant="secondary" size="sm" disabled={isSaving} onClick={() => void submit(true)}>
          {t('wellbeing.meds.intake.logAnother')}
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
