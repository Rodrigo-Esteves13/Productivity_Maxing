import FormField from '../../UI/FormField';
import Input from '../../UI/Input';
import Select from '../../UI/Select';
import { useI18n } from '../../../i18n/useI18n';
import { useAreaOrder } from '../../../hooks/useAreaOrder';

interface AreaOption {
  id: string;
  name: string;
  defaultTaskType: string | null;
}

interface TitleDateAreaFieldsProps {
  idPrefix: string;
  title: string;
  date: string;
  areaId: string;
  areas: AreaOption[];
  // Rotulo do campo de data (ex: "palpite" quando a data ainda nao esta
  // marcada). Sem isto: "Date".
  dateLabel?: string;
  onTitleChange: (value: string) => void;
  onDateChange: (value: string) => void;
  onAreaChange: (areaId: string, defaultTaskType: string | null) => void;
}

export default function TitleDateAreaFields({
  idPrefix,
  title,
  date,
  areaId,
  areas,
  dateLabel,
  onTitleChange,
  onDateChange,
  onAreaChange,
}: TitleDateAreaFieldsProps) {
  const { t } = useI18n();
  const { sortAreas } = useAreaOrder();
  return (
    <>
      <FormField label={t('ui.title')} htmlFor={`${idPrefix}-title`}>
        <Input
          id={`${idPrefix}-title`}
          required
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="w-full"
        />
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label={dateLabel ?? t('ui.date')} htmlFor={`${idPrefix}-date`}>
          <Input
            id={`${idPrefix}-date`}
            required
            type="date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            className="w-full"
          />
        </FormField>
        <FormField label={t('ui.area')} htmlFor={`${idPrefix}-area`}>
          <Select
            id={`${idPrefix}-area`}
            required
            value={areaId}
            onChange={(e) => {
              const newAreaId = e.target.value;
              const newArea = areas.find((a) => a.id === newAreaId);
              onAreaChange(newAreaId, newArea?.defaultTaskType ?? null);
            }}
            className="w-full"
          >
            <option value="" disabled>
              {t('ui.selectArea')}
            </option>
            {sortAreas(areas).map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
    </>
  );
}
