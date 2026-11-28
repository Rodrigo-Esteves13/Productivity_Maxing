import { useState, type FormEvent } from 'react';
import Modal from '../UI/Modal';
import Input from '../UI/Input';
import ActionButton from '../UI/ActionButton';
import ErrorState from '../UI/ErrorState';
import { TrashIcon } from '../UI/Icons';
import { createClass, deleteClass, updateClass, type ClassInput } from '../../api/scheduleService';
import { formatClock, parseClock } from '../../lib/timeFormat';
import { lisbonTodayKey } from '../../lib/dateKey';
import { getApiMessage } from '../../lib/httpError';
import { useFeedback } from '../../context/useFeedback';
import { useUndoableDelete } from '../../hooks/useUndoableDelete';
import { useI18n } from '../../i18n/useI18n';
import type { ClassOccurrence } from '../../types/models';

interface ClassFormModalProps {
  // null = aula nova; senao edita esta aula.
  occurrence: ClassOccurrence | null;
  onClose: () => void;
  // Depois de criar, editar ou apagar: a grelha e o plano refazem o fetch.
  onChanged: () => void;
}

const DEFAULT_START = '09:00';
const DEFAULT_END = '10:00';
const MAX_SUBJECT = 200;
const MAX_LOCATION = 100;
const MAX_PROFESSOR = 150;

// Criar ou corrigir uma aula sem passar por um .ics. Apagar mostra um toast
// com Anular, que recria a aula com os mesmos dados.
export default function ClassFormModal({ occurrence, onClose, onChanged }: ClassFormModalProps) {
  const { t } = useI18n();
  const { notify } = useFeedback();
  const offerUndoDelete = useUndoableDelete();
  const [subject, setSubject] = useState(occurrence?.subject ?? '');
  const [date, setDate] = useState(occurrence?.date.slice(0, 10) ?? lisbonTodayKey());
  const [start, setStart] = useState(occurrence ? formatClock(occurrence.startMinutes) : DEFAULT_START);
  const [end, setEnd] = useState(occurrence ? formatClock(occurrence.endMinutes) : DEFAULT_END);
  const [location, setLocation] = useState(occurrence?.location ?? '');
  const [professor, setProfessor] = useState(occurrence?.professor ?? '');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const startMinutes = parseClock(start);
    const endMinutes = parseClock(end);
    if (!subject.trim()) {
      setError(t('ux4sched.class.subjectRequired'));
      return;
    }
    if (startMinutes === null || endMinutes === null || startMinutes >= endMinutes) {
      setError(t('shiftChange.timeOrder'));
      return;
    }
    const input: ClassInput = {
      date,
      startMinutes,
      endMinutes,
      subject: subject.trim(),
      location: location.trim(),
      professor: professor.trim(),
    };
    setIsSaving(true);
    setError('');
    try {
      if (occurrence) await updateClass(occurrence.id, input);
      else await createClass(input);
      notify(t(occurrence ? 'ux4sched.class.saved' : 'ux4sched.class.created'), 'success');
      onChanged();
      onClose();
    } catch (caught) {
      setError(getApiMessage(caught, t('ux4sched.class.failed')));
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!occurrence) return;
    setIsSaving(true);
    setError('');
    try {
      await deleteClass(occurrence.id);
    } catch (caught) {
      setError(getApiMessage(caught, t('ux4sched.class.deleteFailed')));
      setIsSaving(false);
      return;
    }
    const restoreInput: ClassInput = {
      date: occurrence.date.slice(0, 10),
      startMinutes: occurrence.startMinutes,
      endMinutes: occurrence.endMinutes,
      subject: occurrence.subject,
      ...(occurrence.location && { location: occurrence.location }),
      ...(occurrence.professor && { professor: occurrence.professor }),
    };
    offerUndoDelete({
      message: t('ux4sched.class.deleted', { subject: occurrence.subject }),
      restore: () => createClass(restoreInput),
      onRestored: onChanged,
    });
    onChanged();
    onClose();
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t(occurrence ? 'ux4sched.class.editTitle' : 'ux4sched.class.newTitle')}
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <Input
          label={t('ux4sched.class.subject')}
          value={subject}
          maxLength={MAX_SUBJECT}
          required
          onChange={(e) => setSubject(e.target.value)}
        />
        <Input label={t('ux4sched.class.day')} type="date" value={date} required onChange={(e) => setDate(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label={t('ux4sched.class.start')} type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          <Input label={t('ux4sched.class.end')} type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <Input
          label={t('ux4sched.class.location')}
          value={location}
          maxLength={MAX_LOCATION}
          onChange={(e) => setLocation(e.target.value)}
        />
        <Input
          label={t('ux4sched.class.professor')}
          value={professor}
          maxLength={MAX_PROFESSOR}
          onChange={(e) => setProfessor(e.target.value)}
        />
        {error && <ErrorState message={error} />}
        <div className="flex flex-wrap items-center gap-2">
          <ActionButton type="submit" disabled={isSaving}>
            {isSaving ? t('common.saving') : t('common.save')}
          </ActionButton>
          <button type="button" onClick={onClose} className="px-3 py-2 text-sm text-neutral-400 hover:text-white pointer-coarse:min-h-11">
            {t('common.cancel')}
          </button>
          {occurrence && (
            <button
              type="button"
              disabled={isSaving}
              onClick={() => void handleDelete()}
              className="ml-auto inline-flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 disabled:opacity-50 pointer-coarse:min-h-11"
            >
              <TrashIcon width={14} height={14} />
              {t('common.delete')}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
