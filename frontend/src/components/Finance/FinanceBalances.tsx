import Card from '../UI/Card';
import { FINANCE_BUCKETS, type FinanceBucket, type FinanceSummary } from '../../api/financeService';
import { formatMoney } from '../../lib/money';
import { useI18n } from '../../i18n/useI18n';

interface FinanceBalancesProps {
  summary: FinanceSummary;
}

// Buckets sempre mostrados; o saldo antigo sem conta so aparece quando existe.
const ALWAYS_SHOWN: FinanceBucket[] = FINANCE_BUCKETS.filter((b) => b !== 'UNASSIGNED');

// Saldo total + um cartao por balde (banco, dia a dia, investimento, cripto...)
// e o saldo previsto para o fim do mes.
export default function FinanceBalances({ summary }: FinanceBalancesProps) {
  const { t, lang } = useI18n();
  const { balances, projection } = summary;
  const money = (cents: number) => formatMoney(cents, balances.currency, lang);
  const buckets = ALWAYS_SHOWN.concat(balances.byType.UNASSIGNED !== 0 ? ['UNASSIGNED'] : []);
  const otherCurrencies = Object.entries(balances.otherCurrencies);
  const { gainCents } = balances.investments;

  return (
    <Card className="mb-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-neutral-400">{t('finance.totalBalance')}</p>
          <p className={`text-3xl font-semibold tabular-nums ${balances.totalCents < 0 ? 'text-red-400' : 'text-white'}`}>
            {money(balances.totalCents)}
          </p>
          <p className="text-xs text-neutral-500">{t('finance.totalBalanceHelp')}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-neutral-400">{t('finance.projectedEnd', { date: new Date(`${projection.untilDate}T00:00:00`).toLocaleDateString(lang, { day: 'numeric', month: 'short' }) })}</p>
          <p className={`text-xl font-semibold tabular-nums ${projection.projectedBalanceCents < 0 ? 'text-red-400' : 'text-neutral-100'}`}>
            {money(projection.projectedBalanceCents)}
          </p>
          <p className="text-xs tabular-nums text-neutral-500">
            {t('finance.projectedDetail', {
              income: money(projection.remainingIncomeCents),
              expenses: money(projection.remainingExpenseCents),
            })}
          </p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {buckets.map((bucket) => (
          <div key={bucket} className="rounded-lg bg-neutral-800/50 p-3">
            <dt className="text-xs text-neutral-400">{t(`finance.bucket.${bucket}`)}</dt>
            <dd className={`text-base font-semibold tabular-nums sm:text-lg ${balances.byType[bucket] < 0 ? 'text-red-400' : 'text-white'}`}>
              {money(balances.byType[bucket])}
            </dd>
            {bucket === 'INVESTMENT' && balances.investments.costBasisCents > 0 && (
              <dd className={`text-xs tabular-nums ${gainCents < 0 ? 'text-red-400' : 'text-cyan-400'}`}>
                {gainCents < 0 ? '' : '+'}
                {money(gainCents)}
              </dd>
            )}
          </div>
        ))}
      </dl>

      {otherCurrencies.length > 0 && (
        <p className="mt-3 text-xs text-neutral-500">
          {t('finance.otherCurrencies', {
            amounts: otherCurrencies.map(([code, cents]) => formatMoney(cents, code, lang)).join(', '),
          })}
        </p>
      )}
    </Card>
  );
}
