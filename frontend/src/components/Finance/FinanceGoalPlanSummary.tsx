import Money, { PrivateText } from './Money';
import { FINANCE_GOAL_STATUSES, type FinanceGoal, type FinanceGoalPlanSummary as PlanSummary, type GoalPlanStatus } from '../../api/financeService';
import { useI18n } from '../../i18n/useI18n';

const STATUS_STYLE: Record<GoalPlanStatus, string> = {
  DONE: 'bg-cyan-900/50 text-cyan-400 border-cyan-800',
  ON_TRACK: 'bg-violet-900/50 text-violet-300 border-violet-800',
  AT_RISK: 'bg-orange-900/50 text-orange-400 border-orange-800',
  UNREALISTIC: 'bg-red-900/50 text-red-400 border-red-800',
  NO_DEADLINE: 'bg-neutral-800 text-neutral-400 border-neutral-700',
};

export function GoalStatusBadge({ status }: { status: GoalPlanStatus }) {
  const { t } = useI18n();
  const known = FINANCE_GOAL_STATUSES.includes(status);
  return (
    <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[known ? status : 'NO_DEADLINE']}`}>
      {t(`finance.goalStatus.${status}`)}
    </span>
  );
}

interface FinanceGoalPlanSummaryProps {
  summary: PlanSummary;
  goals: FinanceGoal[];
  currency: string;
}

// Contas dos planos: so aritmetica sobre o que a pessoa escreveu, sem conselhos.
export default function FinanceGoalPlanSummary({ summary, goals, currency }: FinanceGoalPlanSummaryProps) {
  const { t } = useI18n();
  const names = new Map(goals.map((g) => [g.id, g.name]));
  const { surplus } = summary;
  const split = summary.suggestedSplit.filter((s) => s.suggestedMonthlyCents > 0);

  return (
    <div className="mt-5 rounded-lg bg-neutral-800/40 p-4">
      <h3 className="mb-2 text-sm font-semibold text-neutral-200">{t('finance.plans.title')}</h3>
      {surplus.lowConfidence && (
        <p role="status" className="mb-3 rounded-lg border border-amber-800/50 bg-amber-900/10 p-2 text-xs text-amber-300">
          {t('finance.plans.lowConfidence')}
        </p>
      )}
      <dl className="grid grid-cols-2 gap-3 text-center sm:grid-cols-3">
        <div className="rounded-lg bg-neutral-800/60 p-2">
          <dt className="text-xs text-neutral-400">{t('finance.plans.surplus')}</dt>
          <dd className={`text-base font-semibold tabular-nums ${surplus.monthlyCents < 0 ? 'text-red-400' : 'text-white'}`}>
            <Money cents={surplus.monthlyCents} currency={currency} />
          </dd>
        </div>
        <div className="rounded-lg bg-neutral-800/60 p-2">
          <dt className="text-xs text-neutral-400">{t('finance.plans.required')}</dt>
          <dd className="text-base font-semibold tabular-nums text-white">
            <Money cents={summary.totalRequiredMonthlyCents} currency={currency} />
          </dd>
        </div>
        <div className="col-span-2 rounded-lg bg-neutral-800/60 p-2 sm:col-span-1">
          <dt className="text-xs text-neutral-400">{t('finance.plans.planned')}</dt>
          <dd className="text-base font-semibold tabular-nums text-white">
            <Money cents={summary.totalPlannedMonthlyCents} currency={currency} />
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-sm text-neutral-300">
        <PrivateText
          render={(money) =>
            summary.allocationRealistic
              ? t('finance.plans.fits', { required: money(summary.totalRequiredMonthlyCents, currency), surplus: money(summary.availableMonthlyCents, currency) })
              : t('finance.plans.exceeds', { shortfall: money(summary.shortfallCents, currency), surplus: money(summary.availableMonthlyCents, currency) })
          }
        />
      </p>
      <p className="mt-1 text-xs text-neutral-500">{t(`finance.plans.source.${surplus.source}`, { months: surplus.monthsOfData })}</p>
      {split.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-xs font-medium text-neutral-400">{t('finance.plans.split')}</p>
          <ul className="space-y-1 text-sm">
            {split.map((s) => (
              <li key={s.goalId} className="flex justify-between gap-3">
                <span className="truncate text-neutral-300">{names.get(s.goalId)}</span>
                <Money cents={s.suggestedMonthlyCents} currency={currency} className="tabular-nums text-neutral-100" />
              </li>
            ))}
          </ul>
        </div>
      )}
      {summary.overdueGoalIds.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-xs font-medium text-red-400">{t('finance.plans.overdue')}</p>
          <ul className="list-inside list-disc text-sm text-neutral-300">
            {summary.overdueGoalIds.map((id) => (
              <li key={id}>{names.get(id)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
