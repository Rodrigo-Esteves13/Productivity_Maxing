import { useState, type FormEvent } from 'react';
import Card from '../UI/Card';
import Input from '../UI/Input';
import Select from '../UI/Select';
import ActionButton from '../UI/ActionButton';
import IconButton from '../UI/IconButton';
import Modal from '../UI/Modal';
import ProgressBar from '../UI/ProgressBar';
import { PencilIcon, TrashIcon } from '../UI/Icons';
import FinanceSubmitButton from './FinanceSubmitButton';
import FinanceGoalPlanSummary, { GoalStatusBadge } from './FinanceGoalPlanSummary';
import Money, { PrivateText } from './Money';
import {
  FINANCE_GOAL_KINDS,
  type FinanceGoal,
  type FinanceGoalInput,
  type FinanceGoalKind,
  type FinanceGoalPlan,
  type FinanceGoalPlanSummary as PlanSummary,
} from '../../api/financeService';
import { centsToInput, formatPercent, parseMoneyInput } from '../../lib/money';
import { PRIVACY_MASK } from '../../lib/privacy';
import type { SubmitOutcome } from '../../lib/idempotency';
import { useIdempotentSubmit } from '../../hooks/useIdempotentSubmit';
import { usePrivacyMode } from '../../hooks/usePrivacyMode';
import { usePrivateInputClass } from '../../hooks/usePrivacyMode';
import { useI18n } from '../../i18n/useI18n';

const GOAL_NAME_MAX_LENGTH = 80;
const PERCENT_FULL = 100;

interface GoalFormProps {
  initial?: FinanceGoal;
  /** `key` e a Idempotency-Key da tentativa (ignorada ao editar). */
  onSubmit: (input: FinanceGoalInput, key: string) => Promise<SubmitOutcome>;
  onDone?: () => void;
}

// Formulario unico para criar e editar um objetivo (tipo, nome, alvo, poupado,
// prazo e quanto se planeia poupar por mes).
function GoalForm({ initial, onSubmit, onDone }: GoalFormProps) {
  const { t } = useI18n();
  const { submit, isSubmitting } = useIdempotentSubmit();
  const privateInput = usePrivateInputClass();
  const [kind, setKind] = useState<FinanceGoalKind>(initial?.kind ?? 'SAVINGS');
  const [name, setName] = useState(initial?.name ?? '');
  const [target, setTarget] = useState(initial ? centsToInput(initial.targetCents) : '');
  const [saved, setSaved] = useState(initial ? centsToInput(initial.savedCents) : '');
  const [deadline, setDeadline] = useState(initial?.deadline ? initial.deadline.slice(0, 10) : '');
  const [plan, setPlan] = useState(initial ? centsToInput(initial.monthlyPlanCents) : '');
  const [formError, setFormError] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const targetCents = parseMoneyInput(target);
    const savedCents = saved.trim() ? parseMoneyInput(saved) : 0;
    const planCents = plan.trim() ? parseMoneyInput(plan) : null;
    if (!name.trim() || targetCents === null || targetCents <= 0) {
      setFormError(t('finance.invalidGoal'));
      return;
    }
    if (savedCents === null || savedCents < 0 || (plan.trim() && (planCents === null || planCents < 0))) {
      setFormError(t('finance.invalidAmount'));
      return;
    }
    setFormError('');
    const input: FinanceGoalInput = { kind, name: name.trim(), targetCents, savedCents, deadline: deadline || null, monthlyPlanCents: planCents };
    if (await submit((key) => onSubmit(input, key))) {
      if (!initial) {
        setName('');
        setTarget('');
        setSaved('');
        setDeadline('');
        setPlan('');
      }
      onDone?.();
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Select label={t('finance.goalKind')} value={kind} onChange={(e) => setKind(e.target.value as FinanceGoalKind)}>
        {FINANCE_GOAL_KINDS.map((k) => (
          <option key={k} value={k}>
            {t(`finance.goalKind.${k}`)}
          </option>
        ))}
      </Select>
      <Input label={t('finance.goalName')} maxLength={GOAL_NAME_MAX_LENGTH} value={name} onChange={(e) => setName(e.target.value)} />
      <Input className={privateInput} label={t('finance.goalTarget')} inputMode="decimal" placeholder="0.00" value={target} onChange={(e) => setTarget(e.target.value)} />
      <Input className={privateInput} label={t('finance.goalSaved')} inputMode="decimal" placeholder="0.00" value={saved} onChange={(e) => setSaved(e.target.value)} />
      <Input label={t('finance.goalDeadline')} type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
      <Input className={privateInput} label={t('finance.goalMonthlyPlan')} inputMode="decimal" placeholder="0.00" value={plan} onChange={(e) => setPlan(e.target.value)} />
      <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
        <FinanceSubmitButton isSubmitting={isSubmitting}>{initial ? t('finance.save') : t('finance.addGoal')}</FinanceSubmitButton>
        {initial && onDone && (
          <button type="button" onClick={onDone} className="px-3 py-2 text-sm text-neutral-400 hover:text-white">
            {t('common.cancel')}
          </button>
        )}
        {formError && <p className="text-sm text-red-400">{formError}</p>}
      </div>
    </form>
  );
}

interface GoalRowProps {
  goal: FinanceGoal;
  plan: FinanceGoalPlan | undefined;
  currency: string;
  onUpdate: (goal: FinanceGoal, changes: Partial<FinanceGoalInput>) => Promise<boolean>;
  onEdit: (goal: FinanceGoal) => void;
  onRemove: (goal: FinanceGoal) => void;
}

// Campo de valor editavel na linha: com o modo privacidade ligado nao mostra o
// valor guardado (so o que a pessoa escrever).
function useInlineMoney(cents: number | null) {
  const { enabled } = usePrivacyMode();
  const [typed, setTyped] = useState<string | null>(null);
  const shown = typed ?? (enabled ? '' : centsToInput(cents));
  return { shown, typed, setTyped, placeholder: enabled && typed === null ? PRIVACY_MASK : '0.00' };
}

function GoalRow({ goal, plan, currency, onUpdate, onEdit, onRemove }: GoalRowProps) {
  const { t, lang } = useI18n();
  const savedField = useInlineMoney(goal.savedCents);
  const planField = useInlineMoney(goal.monthlyPlanCents);
  const done = goal.savedCents >= goal.targetCents;
  const percent = (goal.savedCents / goal.targetCents) * PERCENT_FULL;
  const parsedSaved = savedField.typed === null ? null : parseMoneyInput(savedField.typed);
  const savedChanged = parsedSaved !== null && parsedSaved >= 0 && parsedSaved !== goal.savedCents;
  const planText = planField.typed?.trim() ?? null;
  const parsedPlan = planText ? parseMoneyInput(planText) : null;
  const planChanged = planText !== null && (planText === '' ? goal.monthlyPlanCents !== null : parsedPlan !== null && parsedPlan >= 0 && parsedPlan !== goal.monthlyPlanCents);

  return (
    <li className="py-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-neutral-100">
            <span className="truncate">{goal.name}</span>
            {plan && <GoalStatusBadge status={plan.status} />}
          </p>
          <p className="text-xs text-neutral-500">
            {done ? (
              t('finance.goalDone')
            ) : (
              <PrivateText render={(money) => t('finance.goalProgress', { saved: money(goal.savedCents, currency), target: money(goal.targetCents, currency) })} />
            )}
            {goal.deadline && ` · ${t('finance.by', { date: new Date(goal.deadline).toLocaleDateString(lang, { timeZone: 'UTC' }) })}`}
            {` · ${formatPercent(Math.min(percent, PERCENT_FULL), lang)}`}
          </p>
        </div>
        <IconButton label={t('finance.editGoal')} onClick={() => onEdit(goal)}>
          <PencilIcon className="h-4 w-4" />
        </IconButton>
        <IconButton label={t('finance.deleteGoal')} tone="danger" onClick={() => onRemove(goal)}>
          <TrashIcon className="h-4 w-4" />
        </IconButton>
      </div>
      <ProgressBar percent={percent} thickness="md" className="mt-2" label={goal.name} />

      {plan && plan.status !== 'DONE' && (
        <dl className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <div>
            <dt className="text-neutral-500">{t('finance.plan.required')}</dt>
            <dd className="tabular-nums text-neutral-200">
              {plan.requiredMonthlyCents === null ? t('finance.plan.noDeadline') : <Money cents={plan.requiredMonthlyCents} currency={currency} />}
            </dd>
          </div>
          <div>
            <dt className="text-neutral-500">{t(plan.planSource === 'USER' ? 'finance.plan.yours' : 'finance.plan.suggested')}</dt>
            <dd className="tabular-nums text-neutral-200">
              <Money cents={plan.plannedMonthlyCents} currency={currency} />
            </dd>
          </div>
          <div>
            <dt className="text-neutral-500">{t('finance.plan.completion')}</dt>
            <dd className="text-neutral-200">
              {plan.projectedCompletionDate ? new Date(`${plan.projectedCompletionDate}T00:00:00`).toLocaleDateString(lang, { month: 'short', year: 'numeric' }) : t('finance.plan.none')}
            </dd>
          </div>
          <div>
            <dt className="text-neutral-500">{t('finance.plan.monthsLeft')}</dt>
            <dd className="tabular-nums text-neutral-200">{plan.monthsLeft === null ? t('finance.plan.none') : plan.monthsLeft}</dd>
          </div>
        </dl>
      )}

      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (savedChanged) void onUpdate(goal, { savedCents: parsedSaved });
          }}
        >
          <Input label={t('finance.goalSaved')} inputMode="decimal" placeholder={savedField.placeholder} value={savedField.shown} onChange={(e) => savedField.setTyped(e.target.value)} />
          <ActionButton type="submit" disabled={!savedChanged}>
            {t('finance.updateSaved')}
          </ActionButton>
        </form>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (planChanged) void onUpdate(goal, { monthlyPlanCents: planText === '' ? null : parsedPlan });
          }}
        >
          <Input label={t('finance.goalMonthlyPlan')} inputMode="decimal" placeholder={planField.placeholder} value={planField.shown} onChange={(e) => planField.setTyped(e.target.value)} />
          <ActionButton type="submit" disabled={!planChanged}>
            {t('finance.setPlan')}
          </ActionButton>
        </form>
      </div>
    </li>
  );
}

interface FinanceGoalsProps {
  goals: FinanceGoal[];
  plans: FinanceGoalPlan[];
  planSummary: PlanSummary;
  currency: string;
  onAdd: (input: FinanceGoalInput, key: string) => Promise<SubmitOutcome>;
  onUpdate: (goal: FinanceGoal, changes: Partial<FinanceGoalInput>) => Promise<boolean>;
  onRemove: (goal: FinanceGoal) => void;
}

// Poupancas, investimentos, lista de desejos e planos a longo prazo, com o
// plano mensal de cada um (aritmetica sobre os dados, sem conselhos).
export default function FinanceGoals({ goals, plans, planSummary, currency, onAdd, onUpdate, onRemove }: FinanceGoalsProps) {
  const { t } = useI18n();
  const [editing, setEditing] = useState<FinanceGoal | null>(null);
  const plansByGoal = new Map(plans.map((p) => [p.goalId, p]));

  return (
    <Card>
      <h2 className="mb-3 text-lg font-semibold text-white">{t('finance.goals')}</h2>
      <GoalForm onSubmit={onAdd} />

      {goals.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">{t('finance.noGoals')}</p>
      ) : (
        <>
          <FinanceGoalPlanSummary summary={planSummary} goals={goals} currency={currency} />
          {FINANCE_GOAL_KINDS.filter((k) => goals.some((g) => g.kind === k)).map((k) => (
            <section key={k} className="mt-5">
              <h3 className="text-sm font-semibold text-neutral-300">{t(`finance.goalKind.${k}`)}</h3>
              <ul className="divide-y divide-neutral-800">
                {goals
                  .filter((g) => g.kind === k)
                  .map((goal) => (
                    <GoalRow
                      key={`${goal.id}-${goal.savedCents}-${goal.monthlyPlanCents}`}
                      goal={goal}
                      plan={plansByGoal.get(goal.id)}
                      currency={currency}
                      onUpdate={onUpdate}
                      onEdit={setEditing}
                      onRemove={onRemove}
                    />
                  ))}
              </ul>
            </section>
          ))}
        </>
      )}

      <Modal isOpen={editing !== null} onClose={() => setEditing(null)} title={t('finance.editGoal')}>
        {editing && <GoalForm initial={editing} onSubmit={(input) => onUpdate(editing, input)} onDone={() => setEditing(null)} />}
      </Modal>
    </Card>
  );
}
