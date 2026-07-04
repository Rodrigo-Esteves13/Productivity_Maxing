import FormField from '../UI/FormField';
import Input from '../UI/Input';
import Select from '../UI/Select';
import type { TaskTypeOption, AcademicTaskTypeOption } from '../../types/models';

interface AreaOption {
  id: string;
  name: string;
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
}

interface TaskFormFieldsProps {
  idPrefix: string;
  values: TaskFormFieldValues;
  onChange: (field: keyof TaskFormFieldValues, value: string) => void;
  areas: AreaOption[];
  taskTypes: TaskTypeOption[];
  academicTaskTypes: AcademicTaskTypeOption[];
  difficulties: string[];
  showRealGrade?: boolean;
}

export default function TaskFormFields({
  idPrefix,
  values,
  onChange,
  areas,
  taskTypes,
  academicTaskTypes,
  difficulties,
  showRealGrade = false,
}: TaskFormFieldsProps) {
  // O tipo "académico" é identificado pela key estável, não pela label
  // (a label pode ser editada pelo admin, a key não).
  const selectedTaskType = taskTypes.find((t) => t.key === values.type);
  const isAcademic = selectedTaskType?.key === 'ACADEMICO';
  const availableAcademicTypes = academicTaskTypes.filter(
    (a) => a.taskTypeKey === values.type
  );
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
            onChange={(e) => onChange('areaId', e.target.value)}
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
                {d.replace(/_/g, ' ')}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Type" htmlFor={`${idPrefix}-type`}>
          <Select
            id={`${idPrefix}-type`}
            value={values.type}
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

      {showRealGrade && (
        <div className="pt-4 border-t border-neutral-800">
          <FormField label="Real Grade" htmlFor={`${idPrefix}-real-grade`} className="max-w-[50%]">
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
        </div>
      )}
    </>
  );
}
