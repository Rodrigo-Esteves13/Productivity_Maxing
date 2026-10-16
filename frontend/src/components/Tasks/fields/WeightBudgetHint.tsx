import { Link } from 'react-router-dom';
import { useWeightBudget } from '../../../hooks/useWeightBudget';
import { useAcademic } from '../../../context/useAcademic';
import { useI18n } from '../../../i18n/useI18n';
import { roundTo } from '../../../utils/roundTo';

interface WeightBudgetHintProps {
  areaId: string;
  taskId?: string;
  weightPercentage: string;
}

// "Falta 10%": mostra quanto da cadeira ja tem peso atribuido (tasks +
// componentes como seminarios) e avisa se o peso escrito estoura os 100%.
// Quando falta peso, sugere um componente de nota (trabalho de aula,
// comportamento) em vez de uma task a poluir a lista.
export default function WeightBudgetHint({ areaId, taskId, weightPercentage }: WeightBudgetHintProps) {
  const { t } = useI18n();
  const { activePeriod } = useAcademic();
  const budget = useWeightBudget(areaId, activePeriod?.id, taskId);
  if (!budget) return null;

  const typed = Number(weightPercentage) || 0;
  const missing = roundTo(budget.remaining - typed);
  const over = missing < 0;

  const message = over
    ? t('weight.budget.over', { over: roundTo(-missing), left: roundTo(budget.remaining) })
    : missing === 0
      ? t('weight.budget.full')
      : t('weight.budget.missing', { assigned: roundTo(budget.used + typed), missing });

  return (
    <div className="space-y-0.5">
      <p role={over ? 'alert' : undefined} className={`text-xs ${over ? 'text-red-400' : 'text-neutral-500'}`}>
        {message}
      </p>
      {!over && missing > 0 && (
        <p className="text-xs text-neutral-600">
          {t('weight.budget.useComponent')}{' '}
          <Link to="/areas" className="text-violet-400 hover:underline">
            {t('grades.title')}
          </Link>
        </p>
      )}
    </div>
  );
}
