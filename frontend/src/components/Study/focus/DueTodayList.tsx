import { useTodayPlan } from '../../../hooks/useTodayPlan';
import PriorityBadge from '../../UI/PriorityBadge';
import { useI18n } from '../../../i18n/useI18n';

// Tasks com prazo hoje, dentro do cartao "Today" do Focus. Antes era um
// cartao proprio que, vazio, ficava esticado pelo masonry ate ao fundo da
// coluna: um bloco enorme so com "No tasks due today".
export default function DueTodayList() {
  const { t } = useI18n();
  const { tasks, isLoading, error } = useTodayPlan();

  if (isLoading) return null;
  if (error) return <p className="text-xs text-red-400">{error}</p>;
  if (tasks.length === 0) return <p className="text-xs text-neutral-500">{t('ui.noTasksDueToday')}</p>;

  return (
    <div>
      <p className="mb-1.5 text-xs uppercase tracking-wide text-neutral-500">{t('ui.dueToday')}</p>
      <ul className="divide-y divide-neutral-800">
        {tasks.map((task) => (
          <li key={task.id} className="flex items-center justify-between gap-3 py-1.5">
            <p className="min-w-0 truncate text-sm text-white">
              {task.title}
              {task.weightPercentage != null && (
                <span className="ml-2 text-xs text-neutral-500">
                  {t('ui.ofFinalGrade', { weightPercentage: task.weightPercentage })}
                </span>
              )}
            </p>
            {task.priority && (
              <PriorityBadge priorityKey={task.priority} label={task.priorityLabel} colorHex={task.priorityColorHex} />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
