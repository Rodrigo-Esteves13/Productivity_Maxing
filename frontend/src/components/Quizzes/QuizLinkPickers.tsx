import { useMemo } from 'react';
import Select from '../UI/Select';
import { getUserAreas } from '../../api/areasService';
import { getUserTasks } from '../../api/tasksService';
import { useLoadOnce } from '../../hooks/useLoadOnce';
import { useI18n } from '../../i18n/useI18n';
import { formatTaskDue } from '../../lib/taskReadiness';

export interface QuizLinkValue {
  areaId: string | null;
  taskId: string | null;
}

interface QuizLinkPickersProps {
  value: QuizLinkValue;
  onChange: (value: QuizLinkValue) => void;
}

// Cadeira e (opcional) task de um quiz, ex.: "Redes" e "Frequencia 2". As
// tasks mostradas sao so as da cadeira escolhida.
export default function QuizLinkPickers({ value, onChange }: QuizLinkPickersProps) {
  const { t } = useI18n();
  const { data: areas } = useLoadOnce(getUserAreas);
  const { data: tasks } = useLoadOnce(getUserTasks);
  const areaTasks = useMemo(() => (tasks ?? []).filter((task) => task.areaId === value.areaId), [tasks, value.areaId]);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Select
        label={t('quizzes.link.area')}
        value={value.areaId ?? ''}
        onChange={(e) => onChange({ areaId: e.target.value || null, taskId: null })}
      >
        <option value="">{t('quizzes.link.noArea')}</option>
        {(areas ?? []).map((area) => (
          <option key={area.id} value={area.id}>
            {area.name}
          </option>
        ))}
      </Select>
      <Select
        label={t('quizzes.link.task')}
        value={value.taskId ?? ''}
        disabled={!value.areaId}
        onChange={(e) => onChange({ ...value, taskId: e.target.value || null })}
      >
        <option value="">{t('quizzes.link.noTask')}</option>
        {areaTasks.map((task) => (
          <option key={task.id} value={task.id}>
            {task.title} ({formatTaskDue(task)})
          </option>
        ))}
      </Select>
    </div>
  );
}
