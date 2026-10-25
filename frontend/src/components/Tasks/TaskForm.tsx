import { useState, type SyntheticEvent } from 'react';
import TaskFormFields, { type TaskFormFieldValues } from './TaskFormFields';
import FormError from '../UI/FormError';
import Button from '../UI/Button';
import { buildTaskPayload } from '../../utils/taskPayload';
import { DEFAULT_DATE_CERTAINTY } from '../../lib/taskReadiness';
import { getApiMessage } from '../../lib/httpError';
import type { Task, TaskTypeOption, AcademicTaskTypeOption, PriorityOption, TaskFormSubmission } from '../../types/models';
import DayLoadHint from './DayLoadHint';
import RecurrenceFields from './RecurrenceFields';
import TaskTemplatePicker from './TaskTemplatePicker';
import { pickTemplateFields, templateFieldsFor, type TaskTemplate } from '../../lib/taskTemplates';
import { EMPTY_RECURRENCE, recurrencePayload, type RecurrenceValue } from '../../lib/recurrence';
import { todayKey } from '../../lib/dateKey';
import { useI18n } from '../../i18n/useI18n';

const DEFAULT_PROGRESS_STATUS = 'ON_TRACK';

interface AreaOption {
  id: string;
  name: string;
  defaultTaskType: string | null;
}

interface TaskFormProps {
  onSubmit: (data: TaskFormSubmission) => Promise<unknown>;
  onCancel: () => void;
  areas: AreaOption[];
  taskTypes: TaskTypeOption[];
  academicTaskTypes: AcademicTaskTypeOption[];
  difficulties: string[];
  priorities: PriorityOption[];
  progressStatuses: string[];
  // Tasks ja existentes: so servem para o aviso de dia/semana carregada.
  existingTasks?: Task[];
}

export default function TaskForm({
  onSubmit,
  onCancel,
  areas,
  taskTypes,
  academicTaskTypes,
  difficulties,
  priorities,
  progressStatuses,
  existingTasks = [],
}: TaskFormProps) {
  const { t } = useI18n();
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Checklist inicial: um passo por linha (opcional).
  const [checklistText, setChecklistText] = useState('');
  const [recurrence, setRecurrence] = useState<RecurrenceValue>(EMPTY_RECURRENCE);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState<TaskFormFieldValues>({
    title: '',
    date: todayKey(),
    // Sem tipo pré-selecionado: escolher o taskTypes[0] por omissão fazia
    // com que "Academic" (order 1 no seed) ficasse ativo em Areas sem tipo
    // associado (ex: hobbies), mostrando os campos académicos por engano.
    // Só fica preenchido quando a Area o define, ou quando o utilizador
    // escolhe manualmente.
    type: '',
    academicType: '',
    difficulty: difficulties[0] || '',
    effort: '',
    dateCertainty: DEFAULT_DATE_CERTAINTY,
    isBlocked: false,
    availableFrom: '',
    // priorities[0] (não 'MEDIUM' fixo) - Priority passou a ser um
    // catálogo gerido pelo admin em /task-types, a key 'MEDIUM' do seed
    // inicial pode não existir mais se ele a renomear/apagar. priorities
    // já vem ordenada por `order` do backend, por isso [0] é sempre "a
    // primeira da lista tal como o admin a configurou" - mesma lógica que
    // já se aplicava a difficulties[0] acima.
    priority: priorities[0]?.key || '',
    areaId: '',
    topics: '',
    referenceLink: '',
    notes: '',
    targetGrade: '',
    weightPercentage: '',
    estimatedMinutes: '',
    recalledStudyMinutes: '',
    isPinned: false,
    // Task nova começa "On track" quando essa opção existe no catálogo.
    progressStatus: progressStatuses.includes(DEFAULT_PROGRESS_STATUS)
      ? DEFAULT_PROGRESS_STATUS
      : (progressStatuses[0] ?? ''),
    // Task nova nunca tem evento ainda - fica ao critério do utilizador
    // marcar a checkbox, não vem pré-marcada.
    syncToCalendar: false,
    calendarTime: '',
    calendarDurationMinutes: '60',
  });

  const updateField = (field: keyof TaskFormFieldValues, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Modelo: aplica os campos guardados por cima (a data fica a escolhida).
  const applyTemplate = (template: TaskTemplate) => {
    const fields = templateFieldsFor(template, new Set(areas.map((a) => a.id)));
    setFormData((prev) => ({ ...prev, ...fields }));
    setChecklistText(template.checklist);
    setRecurrence({ ...EMPTY_RECURRENCE, ...template.recurrence });
  };

  const buildTemplateDraft = (name: string): Omit<TaskTemplate, 'id'> => ({
    name,
    fields: pickTemplateFields({ ...formData }),
    checklist: checklistText,
    recurrence: { frequency: recurrence.frequency, interval: recurrence.interval },
  });

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.areaId) {
      setError(t('ui.pleaseSelectAnArea'));
      return;
    }

    if (!formData.type) {
      setError(t('ui.pleaseSelectAType'));
      return;
    }

    setIsSubmitting(true);

    try {
      // Processamento dos dados para o backend
      const payload = buildTaskPayload(formData);
      const subtasks = checklistText
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .slice(0, 100)
        .map((line) => line.slice(0, 200));

      const withRecurrence = { ...payload, ...recurrencePayload(recurrence, false) };
      await onSubmit(subtasks.length > 0 ? { ...withRecurrence, subtasks } : withRecurrence);
    } catch (err: unknown) {
      setError(getApiMessage(err, t('ui.errorCreatingTask')));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <FormError message={error} />}

      <TaskTemplatePicker onApply={applyTemplate} buildDraft={buildTemplateDraft} suggestedName={formData.title} />

      <TaskFormFields
        idPrefix="create-task"
        values={formData}
        onChange={updateField}
        areas={areas}
        taskTypes={taskTypes}
        academicTaskTypes={academicTaskTypes}
        difficulties={difficulties}
        priorities={priorities}
        progressStatuses={progressStatuses}
        showProgressStatus
      />

      <DayLoadHint date={formData.date} tasks={existingTasks} />

      <RecurrenceFields idPrefix="create-task" value={recurrence} onChange={setRecurrence} />

      <div>
        <label htmlFor="create-task-checklist" className="block text-sm font-medium text-neutral-300 mb-1">
          {t('ui.checklist')} <span className="text-neutral-500 font-normal">{t('ui.optionalOneStepPerLine')}</span>
        </label>
        <textarea
          id="create-task-checklist"
          value={checklistText}
          onChange={(e) => setChecklistText(e.target.value)}
          rows={3}
          placeholder={t('ui.readChapter1SolveWorksheet')}
          className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-violet-600"
        />
      </div>

      <div className="pt-4 flex justify-end gap-3 border-t border-neutral-800">
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t('ui.cancel')}
        </Button>
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? t('common.saving') : t('ui.createTask')}
        </Button>
      </div>
    </form>
  );
}
