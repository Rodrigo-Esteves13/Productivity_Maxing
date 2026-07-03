import FormField from '../UI/FormField';
import Input from '../UI/Input';
import Select from '../UI/Select';

interface AreaOption {
  id: string;
  name: string;
}

export interface TaskFormFieldValues {
  title: string;
  date: string;
  type: string;
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
  taskTypes: string[];
  difficulties: string[];
  showRealGrade?: boolean;
}

export default function TaskFormFields({
  idPrefix,
  values,
  onChange,
  areas,
  taskTypes,
  difficulties,
  showRealGrade = false,
}: TaskFormFieldsProps) {
  return (
    <>
      <FormField label="Título" htmlFor={`${idPrefix}-title`}>
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
        <FormField label="Data" htmlFor={`${idPrefix}-date`}>
          <Input
            id={`${idPrefix}-date`}
            required
            type="date"
            value={values.date}
            onChange={(e) => onChange('date', e.target.value)}
            className="w-full"
          />
        </FormField>
        <FormField label="Área" htmlFor={`${idPrefix}-area`}>
          <Select
            id={`${idPrefix}-area`}
            required
            value={values.areaId}
            onChange={(e) => onChange('areaId', e.target.value)}
            className="w-full"
          >
            <option value="" disabled>
              Selecionar Área...
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
        <FormField label="Dificuldade" htmlFor={`${idPrefix}-difficulty`}>
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
        <FormField label="Tipo" htmlFor={`${idPrefix}-type`}>
          <Select
            id={`${idPrefix}-type`}
            value={values.type}
            onChange={(e) => onChange('type', e.target.value)}
            className="w-full"
          >
            {taskTypes.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, ' ')}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <div className="space-y-4 pt-4 border-t border-neutral-800">
        <p className="text-xs font-semibold text-neutral-500 uppercase">Informação Opcional</p>
        <div className="grid grid-cols-2 gap-4">
          <Input
            placeholder="Tópicos"
            value={values.topics}
            onChange={(e) => onChange('topics', e.target.value)}
            className="w-full"
          />
          <Input
            type="url"
            placeholder="Link de referência"
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
            placeholder="Nota Objetivo"
            value={values.targetGrade}
            onChange={(e) => onChange('targetGrade', e.target.value)}
            className="w-full"
          />
          <Input
            type="number"
            min="0"
            max="100"
            step="0.1"
            placeholder="Peso (%)"
            value={values.weightPercentage}
            onChange={(e) => onChange('weightPercentage', e.target.value)}
            className="w-full"
          />
        </div>
      </div>

      {showRealGrade && (
        <div className="pt-4 border-t border-neutral-800">
          <FormField label="Nota Real" htmlFor={`${idPrefix}-real-grade`} className="max-w-[50%]">
            <Input
              id={`${idPrefix}-real-grade`}
              type="number"
              min="0"
              max="20"
              step="0.1"
              placeholder="Ainda não lançada"
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
