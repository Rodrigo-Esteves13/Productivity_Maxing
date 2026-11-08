import { Link } from 'react-router-dom';
import { useMoneySnapshot } from '../../hooks/useMoneySnapshot';
import { useI18n } from '../../i18n/useI18n';
import { todayKey } from '../../lib/dateKey';
import { formatDayLabel } from '../../lib/timeFormat';
import { hasFinanceData, nextSubscriptionRenewal, overdueOwed } from '../../lib/moneySnapshot';
import { WalletIcon } from '../UI/Icons';
import DashboardCard, { CardHeading } from '../UI/DashboardCard';
import Skeleton from '../UI/Skeleton';
import Money, { PrivateText } from '../Finance/Money';
import { PRIVACY_MASK } from '../../lib/privacy';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-neutral-400">{label}</dt>
      <dd className="text-sm font-semibold tabular-nums text-neutral-100">{children}</dd>
    </div>
  );
}

// Resumo de dinheiro do mes atual. Sem dados de financas, ou se o pedido
// falha, o cartao nao aparece. Valores passam sempre por <Money/> e o nome da
// subscricao por <PrivateText/> (modo privacidade).
export default function MoneySnapshotCard() {
  const { t } = useI18n();
  const { data, renewalOccurrences, isLoading, hasError } = useMoneySnapshot();

  if (isLoading) {
    return (
      <DashboardCard>
        <Skeleton className="mb-3 h-4 w-1/2" />
        <Skeleton className="mb-2 h-4 w-3/4" />
        <Skeleton className="h-4 w-2/3" />
      </DashboardCard>
    );
  }
  if (hasError || !data || !hasFinanceData(data)) return null;

  const currency = data.balances.currency;
  const { projectedBalanceCents } = data.projection;
  const netCents = data.totals.netCents;
  const overdue = overdueOwed(data.owed);
  const renewal = nextSubscriptionRenewal(renewalOccurrences, todayKey());

  return (
    <DashboardCard>
      <CardHeading className="mb-3">
        <WalletIcon className="shrink-0" />
        {t('moneySnapshot.title')}
      </CardHeading>

      <dl className="space-y-2">
        <Row label={t('moneySnapshot.balance')}>
          <Money cents={data.balances.totalCents} currency={currency} />
        </Row>
        <Row label={t('moneySnapshot.expected')}>
          <Money
            cents={projectedBalanceCents}
            currency={currency}
            className={projectedBalanceCents < 0 ? 'text-red-400' : undefined}
          />
        </Row>
        <Row label={t('moneySnapshot.leftOver')}>
          <Money cents={netCents} currency={currency} className={netCents < 0 ? 'text-red-400' : undefined} />
        </Row>
        {overdue.count > 0 && (
          <Row label={t('moneySnapshot.overdue', { count: overdue.count })}>
            <Money cents={overdue.totalCents} currency={currency} className="text-amber-400" />
          </Row>
        )}
        {renewal && (
          <Row label={t('moneySnapshot.renewal')}>
            <span className="text-xs font-normal text-neutral-300">
              {renewal.note && (
                <PrivateText render={(_money, masked) => `${masked ? PRIVACY_MASK : renewal.note}, `} />
              )}
              {formatDayLabel(renewal.date)}
            </span>
          </Row>
        )}
      </dl>

      <Link
        to="/finance"
        className="mt-3 block text-xs text-violet-400 underline decoration-dotted hover:text-violet-300"
      >
        {t('moneySnapshot.open')}
      </Link>
    </DashboardCard>
  );
}
