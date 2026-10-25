import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { getUserTasks } from '../../../api/userService';
import { useLoadOnce } from '../../../hooks/useLoadOnce';
import { buildSessionWindow, toLocalParts } from '../../../lib/sessionWindow';
import { todayKey } from '../../../lib/dateKey';
import { formatTaskDue } from '../../../lib/taskReadiness';
import { groupTasksByArea } from '../../../lib/taskGroups';
import type { StudySession } from '../../../types/models';
import ActionButton from '../../UI/ActionButton';
import ErrorState from '../../UI/ErrorState';
import Input from '../../UI/Input';
import RatingInput from '../../UI/RatingInput';
import Select from '../../UI/Select';
import { useI18n } from '../../../i18n/useI18n';

export interface SessionFormValues {
  startedAt: string;
  endedAt: string;
  note?: string;
  focusRating?: number;
  taskId?: string;
}

interface SessionFormProps {
  // Sem `session` e uma sessao nova (escrita a mao); com `session` e uma correcao.
  session?: StudySession;
  isSaving: boolean;
  // Erro devolvido pelo servidor (ex: sobreposicao).
  serverError: string;
  onSubmit: (values: SessionFormValues) => Promise<void>;
  onCancel: () => void;
}

// So se carrega a lista de tasks quando se abre o formulario de nova sessao.
// Agrupadas por cadeira e com a data, como no widget de sessao: duas
// "Apresentacao 1" de cadeiras diferentes eram impossiveis de distinguir.
function TaskPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { t } = useI18n();
  const { data: tasks } = useLoadOnce(getUserTasks);
  const groups = useMemo(() => groupTasksByArea(tasks ?? [], t('ui.noSubject')), [tasks, t]);
  return (
    <Select label={t('ui.taskOptional')} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{t('ui.noTask')}</option>
      {groups.map(({ label, tasks: groupTasks }) => (
        <optgroup key={label} label={label}>
          {groupTasks.map((task) => (
            <option key={task.id} value={task.id}>
              {task.title} ({formatTaskDue(task)})
            </option>
          ))}
        </optgroup>
      ))}
    </Select>
  );
}

export default function SessionForm({ session, isSaving, serverError, onSubmit, onCancel }: SessionFormProps) {
  const { t } = useI18n();
  const start = session ? toLocalParts(session.startedAt) : null;
  const end = session?.endedAt ? toLocalParts(session.endedAt) : null;

  const [date, setDate] = useState(start?.date ?? todayKey());
  const [startTime, setStartTime] = useState(start?.time ?? '09:00');
  const [endTime, setEndTime] = useState(end?.time ?? '10:00');
  const [taskId, setTaskId] = useState('');
  const [note, setNote] = useState(session?.note ?? '');
  const [rating, setRating] = useState<number | null>(session?.focusRating ?? null);
  const [formError, setFormError] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const window = buildSessionWindow(date, startTime, endTime, new Date());
    if (!window.ok) {
      setFormError(window.error);
      return;
    }
    setFormError('');
    await onSubmit({
      startedAt: window.startedAt,
      endedAt: window.endedAt,
      note: note.trim() || undefined,
      focusRating: rating ?? undefined,
      taskId: taskId || undefined,
    });
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3 rounded-lg bg-neutral-800/40 p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Input label={t('ui.date')} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Input label={t('ui.from')} type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        <Input label={t('ui.to')} type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
      </div>
      {!session && <TaskPicker value={taskId} onChange={setTaskId} />}
      <Input label={t('ui.noteOptional')} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
      <div>
        <p className="mb-1.5 text-sm font-medium text-neutral-300">{t('ui.focusOptional')}</p>
        <RatingInput value={rating} onChange={setRating} />
      </div>
      {(formError || serverError) && <ErrorState message={formError || serverError} />}
      <div className="flex gap-2">
        <ActionButton type="submit" disabled={isSaving}>
          {isSaving ? t('common.saving') : session ? t('sharedEdit.save') : t('ui.addSession')}
        </ActionButton>
        <button type="button" onClick={onCancel} className="px-3 py-2 text-sm text-neutral-400 hover:text-white">
          {t('ui.cancel')}
        </button>
      </div>
    </form>
  );
}
