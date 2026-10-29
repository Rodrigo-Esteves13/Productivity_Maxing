import { useState, type FormEvent } from 'react';
import Card from '../UI/Card';
import Input from '../UI/Input';
import Select from '../UI/Select';
import ActionButton from '../UI/ActionButton';
import IconButton from '../UI/IconButton';
import ProgressBar from '../UI/ProgressBar';
import { TrashIcon } from '../UI/Icons';
import {
  FINANCE_GOAL_KINDS,
  type FinanceGoal,
  type FinanceGoalInput,
  type FinanceGoalKind,
} from '../../api/financeService';
import { centsToInput, formatMoney, parseMoneyInput } from '../../lib/money';
import { useI18n } from '../../i18n/useI18n';

interface FinanceGoalsProps {
  goals: FinanceGoal[];
  currency: string;
  onAdd: (input: FinanceGoalInput) => Promise<boolean>;
  onUpdateSaved: (goal: FinanceGoal, savedCents: number) => Promise<boolean>;
  onRemove: (goal: FinanceGoal) => void;
}

function GoalRow({
  goal,
  money,
  onUpdateSaved,
  onRemove,
}: {
  goal: FinanceGoal;
  money: (c: number) => string;
  onUpdateSaved: FinanceGoalsProps['onUpdateSaved'];
  onRemove: FinanceGoalsProps['onRemove'];
}) {
  const { t, lang } = useI18n();
  const [saved, setSaved] = useState(centsToInput(goal.savedCents));
  const done = goal.savedCents >= goal.targetCents;
  const parsed = parseMoneyInput(saved);
  const changed = parsed !== null && parsed >= 0 && parsed !== goal.savedCents;
  return (
    <li className="py-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-neutral-100">{goal.name}</p>
          <p className="text-xs text-neutral-500">
            {done ? t('finance.goalDone') : t('finance.goalProgress', { saved: money(goal.savedCents), target: money(goal.targetCents) })}
            {goal.deadline &&
              ` · ${t('finance.by', { date: new Date(goal.deadline).toLocaleDateString(lang, { timeZone: 'UTC' }) })}`}
          </p>
        </div>
        <IconButton label={t('finance.deleteGoal')} tone="danger" onClick={() => onRemove(goal)}>
          <TrashIcon className="h-4 w-4" />
        </IconButton>
      </div>
      <ProgressBar
        percent={(goal.savedCents / goal.targetCents) * 100}
        thickness="md"
        className="mt-2"
        label={goal.name}
      />
      <form
        className="mt-2 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (changed) void onUpdateSaved(goal, parsed);
        }}
      >
        <Input label={t('finance.goalSaved')} inputMode="decimal" value={saved} onChange={(e) => setSaved(e.target.value)} />
        <ActionButton type="submit" disabled={!changed}>
          {t('finance.updateSaved')}
        </ActionButton>
      </form>
    </li>
  );
}

// Poupancas, investimentos, lista de desejos e planos a longo prazo.
export default function FinanceGoals({ goals, currency, onAdd, onUpdateSaved, onRemove }: FinanceGoalsProps) {
  const { t, lang } = useI18n();
  const money = (cents: number) => formatMoney(cents, currency, lang);
  const [kind, setKind] = useState<FinanceGoalKind>('SAVINGS');
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [deadline, setDeadline] = useState('');
  const [formError, setFormError] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const targetCents = parseMoneyInput(target);
    if (!name.trim() || targetCents === null || targetCents <= 0) {
      setFormError(t('finance.invalidGoal'));
      return;
    }
    setFormError('');
    if (await onAdd({ kind, name: name.trim(), targetCents, deadline: deadline || null })) {
      setName('');
      setTarget('');
      setDeadline('');
    }
  };

  return (
    <Card>
      <h2 className="mb-3 text-lg font-semibold text-white">{t('finance.goals')}</h2>
      <form onSubmit={(e) => void handleSubmit(e)} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Select label={t('finance.goalKind')} value={kind} onChange={(e) => setKind(e.target.value as FinanceGoalKind)}>
          {FINANCE_GOAL_KINDS.map((k) => (
            <option key={k} value={k}>
              {t(`finance.goalKind.${k}`)}
            </option>
          ))}
        </Select>
        <Input label={t('finance.goalName')} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
        <Input label={t('finance.goalTarget')} inputMode="decimal" placeholder="0.00" value={target} onChange={(e) => setTarget(e.target.value)} />
        <Input label={t('finance.goalDeadline')} type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        <div className="flex items-center gap-3 sm:col-span-4">
          <ActionButton type="submit">{t('finance.addGoal')}</ActionButton>
          {formError && <p className="text-sm text-red-400">{formError}</p>}
        </div>
      </form>

      {goals.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">{t('finance.noGoals')}</p>
      ) : (
        FINANCE_GOAL_KINDS.filter((k) => goals.some((g) => g.kind === k)).map((k) => (
          <section key={k} className="mt-5">
            <h3 className="text-sm font-semibold text-neutral-300">{t(`finance.goalKind.${k}`)}</h3>
            <ul className="divide-y divide-neutral-800">
              {goals
                .filter((g) => g.kind === k)
                .map((goal) => (
                  <GoalRow key={`${goal.id}-${goal.savedCents}`} goal={goal} money={money} onUpdateSaved={onUpdateSaved} onRemove={onRemove} />
                ))}
            </ul>
          </section>
        ))
      )}
    </Card>
  );
}
