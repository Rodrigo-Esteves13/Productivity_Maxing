import { useState, type FormEvent } from 'react';
import Card from '../UI/Card';
import Input from '../UI/Input';
import IconButton from '../UI/IconButton';
import { TrashIcon } from '../UI/Icons';
import FinanceSubmitButton from './FinanceSubmitButton';
import Money, { PrivateText } from './Money';
import type { FinanceHeldByEmployer, FinanceOwed as OwedData, FinanceOwedItem } from '../../api/financeService';
import { formatPercent, parseMoneyInput } from '../../lib/money';
import { toLocalDateKey } from '../../lib/dateKey';
import { useIdempotentSubmit } from '../../hooks/useIdempotentSubmit';
import { useI18n } from '../../i18n/useI18n';

export interface ReceivedChanges {
  receivedAt: string;
  amountCents?: number;
}

const dayLabel = (day: string, lang: string) => new Date(`${day}T00:00:00`).toLocaleDateString(lang);

interface ReceivedFormProps {
  item: FinanceOwedItem;
  onSubmit: (changes: ReceivedChanges) => Promise<boolean>;
  onCancel: () => void;
}

// "Marcar como recebido": dia (nao antes do emprestimo) e valor recebido opcional.
function ReceivedForm({ item, onSubmit, onCancel }: ReceivedFormProps) {
  const { t } = useI18n();
  const { submit, isSubmitting } = useIdempotentSubmit();
  const [day, setDay] = useState(toLocalDateKey(new Date()));
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const cents = amount.trim() ? parseMoneyInput(amount) : null;
    if (!day || day < item.since || (amount.trim() && (cents === null || cents <= 0))) {
      setError(t('finance.owed.invalidReceived'));
      return;
    }
    setError('');
    const changes: ReceivedChanges = { receivedAt: day, ...(cents !== null && { amountCents: cents }) };
    if (await submit(() => onSubmit(changes))) onCancel();
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Input label={t('finance.owed.receivedOn')} type="date" min={item.since} value={day} onChange={(e) => setDay(e.target.value)} />
      <Input label={t('finance.owed.receivedAmount')} inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <FinanceSubmitButton isSubmitting={isSubmitting}>{t('finance.owed.confirmReceived')}</FinanceSubmitButton>
        <button type="button" onClick={onCancel} className="px-3 py-2 text-sm text-neutral-400 hover:text-white">
          {t('common.cancel')}
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </form>
  );
}

interface OwedRowProps {
  item: FinanceOwedItem;
  currency: string;
  onReceived: (item: FinanceOwedItem, changes: ReceivedChanges) => Promise<boolean>;
  onRemove: (item: FinanceOwedItem) => void;
}

function OwedRow({ item, currency, onReceived, onRemove }: OwedRowProps) {
  const { t, lang } = useI18n();
  const [receiving, setReceiving] = useState(false);
  const hasInterest = item.interestKind !== 'NONE' && item.interestRatePct !== null;
  return (
    <li className="py-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-neutral-100">
            <span className="truncate">{item.debtorName ?? item.note ?? t('finance.owed.someone')}</span>
            {item.overdue && (
              <span className="rounded-full border border-red-800 bg-red-900/50 px-2 py-0.5 text-[11px] font-semibold text-red-400">
                {t('finance.owed.overdueDays', { count: item.daysLate })}
              </span>
            )}
          </p>
          <p className="text-xs text-neutral-500">
            {t('finance.owed.since', { date: dayLabel(item.since, lang) })}
            {item.expectedDate && ` · ${t('finance.owed.dueOn', { date: dayLabel(item.expectedDate, lang) })}`}
            {hasInterest && ` · ${t(`finance.owed.interest.${item.interestKind}`)} ${formatPercent(item.interestRatePct ?? 0, lang)}`}
          </p>
        </div>
        <IconButton label={t('finance.owed.delete')} tone="danger" onClick={() => onRemove(item)}>
          <TrashIcon className="h-4 w-4" />
        </IconButton>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <div>
          <dt className="text-neutral-500">{t('finance.owed.principal')}</dt>
          <dd className="tabular-nums text-neutral-200"><Money cents={item.principalCents} currency={currency} /></dd>
        </div>
        <div>
          <dt className="text-neutral-500">{t('finance.owed.interestToDate')}</dt>
          <dd className="tabular-nums text-neutral-200"><Money cents={item.interestToDateCents} currency={currency} prefix="+" /></dd>
        </div>
        <div>
          <dt className="text-neutral-500">{t('finance.owed.valueToday')}</dt>
          <dd className="tabular-nums text-neutral-100"><Money cents={item.valueTodayCents} currency={currency} /></dd>
        </div>
        <div>
          <dt className="text-neutral-500">{t('finance.owed.riskWeighted', { percent: formatPercent(item.latePaymentRiskPct, lang) })}</dt>
          <dd className="tabular-nums text-neutral-100"><Money cents={item.expectedValueCents} currency={currency} /></dd>
        </div>
      </dl>
      {item.lateScenario && (
        <p className="mt-1 text-xs text-neutral-500">
          <PrivateText
            render={(money) =>
              t('finance.owed.lateScenario', { date: dayLabel(item.lateScenario?.date ?? item.since, lang), amount: money(item.lateScenario?.valueCents ?? 0, currency) })
            }
          />
        </p>
      )}
      {receiving ? (
        <ReceivedForm item={item} onSubmit={(changes) => onReceived(item, changes)} onCancel={() => setReceiving(false)} />
      ) : (
        <button type="button" onClick={() => setReceiving(true)} className="mt-2 text-sm text-violet-400 hover:text-violet-300">
          {t('finance.owed.markReceived')}
        </button>
      )}
    </li>
  );
}

interface FinanceOwedProps {
  owed: OwedData;
  held: FinanceHeldByEmployer;
  currency: string;
  onReceived: OwedRowProps['onReceived'];
  onRemove: OwedRowProps['onRemove'];
}

// Dinheiro que me devem (fora do saldo ate ser recebido) e dinheiro retido
// pelo empregador (so informativo).
export default function FinanceOwed({ owed, held, currency, onReceived, onRemove }: FinanceOwedProps) {
  const { t, lang } = useI18n();
  return (
    <>
      <Card className="mb-6">
        <h3 className="mb-1 text-sm font-semibold text-neutral-200">{t('finance.owed.panelTitle')}</h3>
        <p className="mb-3 text-xs text-neutral-500">{t('finance.owed.panelHelp')}</p>
        {owed.items.length === 0 ? (
          <p className="text-sm text-neutral-500">{t('finance.owed.empty')}</p>
        ) : (
          <>
            <dl className="mb-2 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg bg-neutral-800/50 p-2">
                <dt className="text-xs text-neutral-400">{t('finance.owed.totalOwed')}</dt>
                <dd className="text-base font-semibold tabular-nums text-white"><Money cents={owed.totalOwedCents} currency={currency} /></dd>
              </div>
              <div className="rounded-lg bg-neutral-800/50 p-2">
                <dt className="text-xs text-neutral-400">{t('finance.owed.totalRisk')}</dt>
                <dd className="text-base font-semibold tabular-nums text-white"><Money cents={owed.totalRiskWeightedCents} currency={currency} /></dd>
              </div>
              <div className="rounded-lg bg-neutral-800/50 p-2">
                <dt className="text-xs text-neutral-400">{t('finance.owed.overdueCount')}</dt>
                <dd className="text-base font-semibold tabular-nums text-white">{owed.overdueCount}</dd>
              </div>
            </dl>
            <ul className="divide-y divide-neutral-800">
              {owed.items.map((item) => (
                <OwedRow key={item.entryId} item={item} currency={currency} onReceived={onReceived} onRemove={onRemove} />
              ))}
            </ul>
          </>
        )}
      </Card>
      {held.items.length > 0 && (
        <Card className="mb-6">
          <h3 className="mb-1 text-sm font-semibold text-neutral-200">{t('finance.held.title')}</h3>
          <p className="mb-3 text-xs text-neutral-500">{t('finance.held.help')}</p>
          <p className="mb-2 text-lg font-semibold tabular-nums text-white"><Money cents={held.totalCents} currency={currency} /></p>
          <ul className="space-y-1 text-sm">
            {held.items.map((h) => (
              <li key={h.entryId} className="flex flex-wrap justify-between gap-2">
                <span className="text-neutral-300">
                  {h.note ?? t('finance.held.fallbackName')}
                  <span className="text-neutral-500"> · {t('finance.held.since', { date: dayLabel(h.since, lang) })}</span>
                </span>
                <span className="tabular-nums text-neutral-200">
                  <Money cents={h.withheldCents} currency={currency} />
                  <span className="ml-2 text-xs text-neutral-500">
                    {h.releaseDate ? t('finance.held.release', { date: dayLabel(h.releaseDate, lang) }) : t('finance.held.noRelease')}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
