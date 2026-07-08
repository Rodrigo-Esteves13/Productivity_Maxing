import FormField from '../UI/FormField';
import Input from '../UI/Input';
import Select from '../UI/Select';
import type { TaskTypeOption, AcademicTaskTypeOption } from '../../types/models';
import { formatEnumLabel } from '../../utils/formatEnumLabel';

interface AreaOption {
  id: string;
  name: string;
  defaultTaskType: string | null;
}

export interface TaskFormFieldValues {
  title: string;
  date: string;
  type: string;
  academicType: string;
  difficulty: string;
  areaId: string;
  topics: string;
  referenceLink: string;
  targetGrade: string;
  weightPercentage: string;
  realGrade?: string;
  progressStatus?: string;
}

interface TaskFormFieldsProps {
  idPrefix: string;
  values: TaskFormFieldValues;
  onChange: (field: keyof TaskFormFieldValues, value: string) => void;
  areas: AreaOption[];
  taskTypes: TaskTypeOption[];
  academicTaskTypes: AcademicTaskTypeOption[];
  difficulties: string[];
  progressStatuses?: string[];
  showRealGrade?: boolean;
  showProgressStatus?: boolean;
}

export default function TaskFormFields({
  idPrefix,
  values,
  onChange,
  areas,
  taskTypes,
  academicTaskTypes,
  difficulties,
  progressStatuses = [],
  showRealGrade = false,
  showProgressStatus = false,
}: TaskFormFieldsProps) {
  // O tipo "académico" é identificado pela key estável, não pela label
  // (a label pode ser editada pelo admin, a key não).
  const selectedTaskType = taskTypes.find((t) => t.key === values.type);
  const isAcademic = selectedTaskType?.key === 'ACADEMICO';
  const availableAcademicTypes = academicTaskTypes.filter(
    (a) => a.taskTypeKey === values.type
  );

  // Se a Area escolhida tiver um Type associado (ex: "CDR" -> Académico),
  // o Type deixa de ser uma escolha manual - fica preenchido e trancado.
  // Areas sem Type associado (ex: um hobby) continuam a pedir o Type à mão.
  const selectedArea = areas.find((a) => a.id === values.areaId);
  const isTypeLockedByArea = Boolean(selectedArea?.defaultTaskType);
  return (
    <>
      <FormField label="Title" htmlFor={`${idPrefix}-title`}>
        <Input
          id={`${idPrefix}-title`}
          required
          type="text"
          value={values.title}
          onChange={(e) => onChange('title', e.target.value)}
          className="w-full"
        />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Date" htmlFor={`${idPrefix}-date`}>
          <Input
            id={`${idPrefix}-date`}
            required
            type="date"
            value={values.date}
            onChange={(e) => onChange('date', e.target.value)}
            className="w-full"
          />
        </FormField>
        <FormField label="Area" htmlFor={`${idPrefix}-area`}>
          <Select
            id={`${idPrefix}-area`}
            required
            value={values.areaId}
            onChange={(e) => {
              const newAreaId = e.target.value;
              onChange('areaId', newAreaId);

              const newArea = areas.find((a) => a.id === newAreaId);
              if (newArea?.defaultTaskType) {
                // Area com tipo associado (ex: "CDR" -> Académico): o Type
                // passa a ser automático, não uma escolha manual.
                onChange('type', newArea.defaultTaskType);
                onChange('academicType', '');
              }
            }}
            className="w-full"
          >
            <option value="" disabled>
              Select Area...
            </option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Difficulty" htmlFor={`${idPrefix}-difficulty`}>
          <Select
            id={`${idPrefix}-difficulty`}
            value={values.difficulty}
            onChange={(e) => onChange('difficulty', e.target.value)}
            className="w-full"
          >
            {difficulties.map((d) => (
              <option key={d} value={d}>
                {formatEnumLabel(d)}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Type" htmlFor={`${idPrefix}-type`}>
          <Select
            id={`${idPrefix}-type`}
            value={values.type}
            disabled={isTypeLockedByArea}
            onChange={(e) => {
              onChange('type', e.target.value);
              // Muda-se o tipo, limpa-se o academicType para não ficar
              // um valor "orfão" que já não pertence ao novo tipo.
              onChange('academicType', '');
            }}
            className="w-full"
          >
            {taskTypes.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </Select>
          {isTypeLockedByArea && (
            <p className="mt-1 text-xs text-neutral-500">
              Set automatically by the "{selectedArea?.name}" Area.
            </p>
          )}
        </FormField>
      </div>

      {isAcademic && (
        <FormField label="Academic Type" htmlFor={`${idPrefix}-academic-type`}>
          <Select
            id={`${idPrefix}-academic-type`}
            value={values.academicType}
            onChange={(e) => onChange('academicType', e.target.value)}
            className="w-full"
          >
            <option value="">Select Academic Type...</option>
            {availableAcademicTypes.map((a) => (
              <option key={a.key} value={a.key}>
                {a.label}
              </option>
            ))}
          </Select>
        </FormField>
      )}

      {isAcademic && (
        <div className="space-y-4 pt-4 border-t border-neutral-800">
          <p className="text-xs font-semibold text-neutral-500 uppercase">Academic Details</p>
          <div className="grid grid-cols-2 gap-4">
            <Input
              type="number"
              min="0"
              max="20"
              step="0.1"
              placeholder="Target Grade"
              value={values.targetGrade}
              onChange={(e) => onChange('targetGrade', e.target.value)}
              className="w-full"
            />
            <Input
              type="number"
              min="0"
              max="100"
              step="0.1"
              placeholder="Weight (%)"
              value={values.weightPercentage}
              onChange={(e) => onChange('weightPercentage', e.target.value)}
              className="w-full"
            />
          </div>
        </div>
      )}

      <div className="space-y-4 pt-4 border-t border-neutral-800">
        <p className="text-xs font-semibold text-neutral-500 uppercase">Optional Information</p>
        <div className="grid grid-cols-2 gap-4">
          <Input
            placeholder="Topics"
            value={values.topics}
            onChange={(e) => onChange('topics', e.target.value)}
            className="w-full"
          />
          <Input
            type="url"
            placeholder="Reference link"
            value={values.referenceLink}
            onChange={(e) => onChange('referenceLink', e.target.value)}
            className="w-full"
          />
        </div>
        <div className="flex items-start gap-2 pt-1">
          <input
            type="checkbox"
            disabled
            className="mt-0.5 h-4 w-4 rounded border-neutral-700 bg-neutral-900 text-violet-600 opacity-60 cursor-not-allowed"
          />
          <div>
            <span className="text-sm text-neutral-400">Add to Google Calendar</span>
            <p className="text-xs text-neutral-600">Will work in a future release.</p>
          </div>
        </div>
      </div>

      {(showProgressStatus || showRealGrade) && (
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-neutral-800">
          {showProgressStatus && (
            <FormField label="Progress" htmlFor={`${idPrefix}-progress-status`}>
              <Select
                id={`${idPrefix}-progress-status`}
                value={values.progressStatus ?? ''}
                onChange={(e) => onChange('progressStatus', e.target.value)}
                className="w-full"
              >
                {progressStatuses.map((status) => (
                  <option key={status} value={status}>
                    {formatEnumLabel(status)}
                  </option>
                ))}
              </Select>
            </FormField>
          )}
          {showRealGrade && isAcademic && (
            <FormField label="Real Grade" htmlFor={`${idPrefix}-real-grade`}>
              <Input
                id={`${idPrefix}-real-grade`}
                type="number"
                min="0"
                max="20"
                step="0.1"
                placeholder="Not entered yet"
                value={values.realGrade ?? ''}
                onChange={(e) => onChange('realGrade', e.target.value)}
                className="w-full"
              />
            </FormField>
          )}
        </div>
      )}
    </>
  );
}
