import { useCallback, useState } from 'react';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import ErrorState from '../components/UI/ErrorState';
import CardGridSkeleton from '../components/UI/CardGridSkeleton';
import IconButton from '../components/UI/IconButton';
import { ChevronLeftIcon, ChevronRightIcon } from '../components/UI/Icons';
import FinanceOverview from '../components/Finance/FinanceOverview';
import FinanceEntries from '../components/Finance/FinanceEntries';
import FinanceGoals from '../components/Finance/FinanceGoals';
import ConfirmActionDialog from '../components/Turma/ConfirmActionDialog';
import { useConfirmAction } from '../hooks/useConfirmAction';
import { useFinance } from '../hooks/useFinance';
import useDocumentTitle from '../hooks/useDocumentTitle';
import type { FinanceEntry, FinanceGoal } from '../api/financeService';
import { formatMoney, monthKey, shiftMonth } from '../lib/money';
import { toLocalDateKey } from '../lib/dateKey';
import { useI18n } from '../i18n/useI18n';

// Financas pessoais: saldo, entradas e saidas do mes, limites e objetivos.
// So regista e soma o que a pessoa escreve: nao e aconselhamento.
export default function Finance() {
  const { t, lang } = useI18n();
  useDocumentTitle(t('finance.title'));
  const currentMonth = monthKey(new Date());
  const [month, setMonth] = useState(currentMonth);
  const { data, error, saveSettings, addEntry, removeEntry, addGoal, updateGoal, removeGoal } = useFinance(month);
  const confirm = useConfirmAction(t('finance.saveError'));
  const { request } = confirm;
  const currency = data?.settings.currency ?? 'EUR';

  const requestRemoveEntry = useCallback(
    (entry: FinanceEntry) =>
      request({
        title: t('finance.deleteEntry'),
        message: t('finance.deleteEntryConfirm', { amount: formatMoney(entry.amountCents, currency, lang) }),
        confirmLabel: t('common.delete'),
        tone: 'danger',
        run: async () => {
          await removeEntry(entry.id);
        },
      }),
    [request, removeEntry, t, currency, lang],
  );

  const requestRemoveGoal = useCallback(
    (goal: FinanceGoal) =>
      request({
        title: t('finance.deleteGoal'),
        message: t('finance.deleteGoalConfirm', { name: goal.name }),
        confirmLabel: t('common.delete'),
        tone: 'danger',
        run: async () => {
          await removeGoal(goal.id);
        },
      }),
    [request, removeGoal, t],
  );

  const [year, monthIndex] = month.split('-').map(Number);
  const monthLabel = new Date(year, monthIndex - 1, 1).toLocaleDateString(lang, { month: 'long', year: 'numeric' });
  // Novas entradas: hoje no mes atual, dia 1 noutro mes.
  const defaultDate = month === currentMonth ? toLocalDateKey(new Date()) : `${month}-01`;

  return (
    <PageLayout>
      <PageHeader title={t('finance.title')} description={t('finance.description')} />
      <p className="mb-6 rounded-lg border border-amber-800/50 bg-amber-900/10 p-3 text-sm text-amber-300">
        {t('finance.disclaimer')}
      </p>
      <div className="mb-4 flex items-center gap-2">
        <IconButton label={t('finance.prevMonth')} onClick={() => setMonth((m) => shiftMonth(m, -1))}>
          <ChevronLeftIcon className="h-5 w-5" />
        </IconButton>
        <h2 className="min-w-40 text-center text-base font-semibold capitalize text-white">{monthLabel}</h2>
        <IconButton label={t('finance.nextMonth')} onClick={() => setMonth((m) => shiftMonth(m, 1))}>
          <ChevronRightIcon className="h-5 w-5" />
        </IconButton>
      </div>
      {error ? (
        <ErrorState message={t('finance.loadError')} />
      ) : !data ? (
        <CardGridSkeleton cards={3} />
      ) : (
        <>
          <FinanceOverview key={`${data.settings.currency}-${data.settings.balanceCents}`} summary={data} onSaveSettings={saveSettings} />
          <FinanceEntries key={month} summary={data} defaultDate={defaultDate} onAdd={addEntry} onRemove={requestRemoveEntry} />
          <FinanceGoals
            goals={data.goals}
            currency={currency}
            onAdd={addGoal}
            onUpdateSaved={(goal, savedCents) => updateGoal(goal.id, { savedCents })}
            onRemove={requestRemoveGoal}
          />
        </>
      )}
      <ConfirmActionDialog state={confirm} />
    </PageLayout>
  );
}
