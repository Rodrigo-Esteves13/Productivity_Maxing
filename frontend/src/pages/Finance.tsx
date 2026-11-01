import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import ErrorState from '../components/UI/ErrorState';
import CardGridSkeleton from '../components/UI/CardGridSkeleton';
import IconButton from '../components/UI/IconButton';
import { ChevronLeftIcon, ChevronRightIcon } from '../components/UI/Icons';
import FinanceBalances from '../components/Finance/FinanceBalances';
import FinanceOverview from '../components/Finance/FinanceOverview';
import FinanceAccounts from '../components/Finance/FinanceAccounts';
import FinanceEntries from '../components/Finance/FinanceEntries';
import FinanceHoldings from '../components/Finance/FinanceHoldings';
import FinanceAnalytics from '../components/Finance/FinanceAnalytics';
import FinanceGoals from '../components/Finance/FinanceGoals';
import ConfirmActionDialog from '../components/Turma/ConfirmActionDialog';
import { useConfirmAction } from '../hooks/useConfirmAction';
import { useFinance } from '../hooks/useFinance';
import useDocumentTitle from '../hooks/useDocumentTitle';
import type { FinanceAccount, FinanceEntry, FinanceEntryKind, FinanceGoal, FinanceHolding } from '../api/financeService';
import { formatMoney, monthKey, shiftMonth } from '../lib/money';
import { toLocalDateKey } from '../lib/dateKey';
import { useI18n } from '../i18n/useI18n';

// Atalhos (paleta de comandos): /finance?add=expense|income|holding|account.
const ADD_PARAM = 'add';
const ADD_TARGETS: Record<string, { id: string; kind?: FinanceEntryKind }> = {
  expense: { id: 'finance-entry-amount', kind: 'EXPENSE' },
  income: { id: 'finance-entry-amount', kind: 'INCOME' },
  holding: { id: 'finance-holding-symbol' },
  account: { id: 'finance-accounts' },
};

// Financas pessoais: saldos por tipo de conta, entradas e saidas, investimentos
// com preco atualizado, analitica e objetivos. So regista e soma o que a
// pessoa escreve: nao e aconselhamento.
export default function Finance() {
  const { t, lang } = useI18n();
  useDocumentTitle(t('finance.title'));
  const currentMonth = monthKey(new Date());
  const [month, setMonth] = useState(currentMonth);
  const finance = useFinance(month);
  const { data, error } = finance;
  const confirm = useConfirmAction(t('finance.saveError'));
  const { request } = confirm;
  const currency = data?.settings.currency ?? 'EUR';
  const [searchParams, setSearchParams] = useSearchParams();
  const [initialKind, setInitialKind] = useState<FinanceEntryKind | undefined>();

  // Atalho pedido: foca o campo certo e limpa o parametro.
  const addTarget = ADD_TARGETS[searchParams.get(ADD_PARAM) ?? ''];
  useEffect(() => {
    if (!addTarget || !data) return;
    setInitialKind(addTarget.kind);
    const frame = requestAnimationFrame(() => {
      const el = document.getElementById(addTarget.id);
      el?.scrollIntoView({ block: 'center' });
      el?.focus({ preventScroll: true });
    });
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete(ADD_PARAM);
      return next;
    }, { replace: true });
    return () => cancelAnimationFrame(frame);
  }, [addTarget, data, setSearchParams]);

  const confirmDelete = useCallback(
    (title: string, message: string, run: () => Promise<boolean>) =>
      request({
        title,
        message,
        confirmLabel: t('common.delete'),
        tone: 'danger',
        run: async () => {
          await run();
        },
      }),
    [request, t],
  );

  const { removeEntry, removeGoal, removeAccount, removeHolding } = finance;
  const requestRemoveEntry = useCallback(
    (entry: FinanceEntry) =>
      confirmDelete(
        t('finance.deleteEntry'),
        t(entry.frequency ? 'finance.deleteRuleConfirm' : 'finance.deleteEntryConfirm', { amount: formatMoney(entry.amountCents, currency, lang) }),
        () => removeEntry(entry.id),
      ),
    [confirmDelete, removeEntry, t, currency, lang],
  );
  const requestRemoveGoal = useCallback(
    (goal: FinanceGoal) => confirmDelete(t('finance.deleteGoal'), t('finance.deleteGoalConfirm', { name: goal.name }), () => removeGoal(goal.id)),
    [confirmDelete, removeGoal, t],
  );
  const requestRemoveAccount = useCallback(
    (account: FinanceAccount) =>
      confirmDelete(t('finance.deleteAccount'), t('finance.deleteAccountConfirm', { name: account.name }), () => removeAccount(account.id)),
    [confirmDelete, removeAccount, t],
  );
  const requestRemoveHolding = useCallback(
    (holding: FinanceHolding) =>
      confirmDelete(t('finance.deleteHolding'), t('finance.deleteHoldingConfirm', { symbol: holding.symbol }), () => removeHolding(holding.id)),
    [confirmDelete, removeHolding, t],
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
      {error && !data ? (
        <ErrorState message={t('finance.loadError')} />
      ) : !data ? (
        <CardGridSkeleton cards={3} />
      ) : (
        <>
          <FinanceBalances summary={data} />
          <FinanceOverview key={data.settings.currency} summary={data} onSaveSettings={finance.saveSettings} />
          <FinanceHoldings
            holdings={data.holdings}
            accounts={data.accounts}
            currency={currency}
            isRefreshing={finance.isRefreshing}
            onRefresh={() => void finance.refreshPrices()}
            onAdd={finance.addHolding}
            onRemove={requestRemoveHolding}
          />
          <FinanceEntries
            key={month}
            summary={data}
            defaultDate={defaultDate}
            initialKind={initialKind}
            onAdd={finance.addEntry}
            onUpdate={finance.updateEntry}
            onRemove={requestRemoveEntry}
          />
          <FinanceAnalytics refreshKey={finance.version} currency={currency} />
          <div id="finance-accounts" tabIndex={-1}>
            <FinanceAccounts
              accounts={data.accounts}
              currency={currency}
              onAdd={finance.addAccount}
              onUpdate={finance.updateAccount}
              onRemove={requestRemoveAccount}
            />
          </div>
          <FinanceGoals
            goals={data.goals}
            currency={currency}
            onAdd={finance.addGoal}
            onUpdateSaved={(goal, savedCents) => finance.updateGoal(goal.id, { savedCents })}
            onRemove={requestRemoveGoal}
          />
        </>
      )}
      <ConfirmActionDialog state={confirm} />
    </PageLayout>
  );
}
