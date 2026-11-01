import Card from '../UI/Card';
import { FINANCE_BUCKETS, type FinanceBucket, type FinanceSummary } from '../../api/financeService';
import Money, { PrivateText } from './Money';
import { formatMoney } from '../../lib/money';
import { PRIVACY_MASK } from '../../lib/privacy';
import { usePrivacyMode } from '../../hooks/usePrivacyMode';
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
  const { balances, projection, projectionWithOwed } = summary;
  const { enabled: privacyOn } = usePrivacyMode();
  const { currency } = balances;
  const owedAdded = projectionWithOwed.owedRiskWeightedCents;
  const buckets = ALWAYS_SHOWN.concat(balances.byType.UNASSIGNED !== 0 ? ['UNASSIGNED'] : []);
  const otherCurrencies = Object.entries(balances.otherCurrencies);
  const { gainCents } = balances.investments;

  return (
    <Card className="mb-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-neutral-400">{t('finance.totalBalance')}</p>
          <p className={`text-3xl font-semibold tabular-nums ${balances.totalCents < 0 ? 'text-red-400' : 'text-white'}`}>
            <Money cents={balances.totalCents} currency={currency} />
          </p>
          <p className="text-xs text-neutral-500">{t('finance.totalBalanceHelp')}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-neutral-400">{t('finance.projectedEnd', { date: new Date(`${projection.untilDate}T00:00:00`).toLocaleDateString(lang, { day: 'numeric', month: 'short' }) })}</p>
          <p className={`text-xl font-semibold tabular-nums ${projection.projectedBalanceCents < 0 ? 'text-red-400' : 'text-neutral-100'}`}>
            <Money cents={projection.projectedBalanceCents} currency={currency} />
          </p>
          {privacyOn && (
            <p className={`text-xs font-medium ${projection.projectedBalanceCents < 0 ? 'text-red-400' : 'text-cyan-400'}`}>
              {t(projection.projectedBalanceCents < 0 ? 'finance.privacy.negative' : 'finance.privacy.positive')}
            </p>
          )}
          <p className="text-xs tabular-nums text-neutral-500">
            <PrivateText
              render={(money) =>
                t('finance.projectedDetail', {
                  income: money(projection.remainingIncomeCents, currency),
                  expenses: money(projection.remainingExpenseCents, currency),
                })
              }
            />
          </p>
          {owedAdded > 0 && (
            <p className="mt-1 text-xs tabular-nums text-neutral-400">
              <PrivateText
                render={(money) =>
                  t('finance.projectedWithOwed', {
                    amount: money(projectionWithOwed.projectedBalanceCents, currency),
                    owed: money(owedAdded, currency),
                  })
                }
              />
            </p>
          )}
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {buckets.map((bucket) => (
          <div key={bucket} className="rounded-lg bg-neutral-800/50 p-3">
            <dt className="text-xs text-neutral-400">{t(`finance.bucket.${bucket}`)}</dt>
            <dd className={`text-base font-semibold tabular-nums sm:text-lg ${balances.byType[bucket] < 0 ? 'text-red-400' : 'text-white'}`}>
              <Money cents={balances.byType[bucket]} currency={currency} />
            </dd>
            {bucket === 'INVESTMENT' && balances.investments.costBasisCents > 0 && (
              <dd className={`text-xs tabular-nums ${gainCents < 0 ? 'text-red-400' : 'text-cyan-400'}`}>
                <Money cents={gainCents} currency={currency} prefix={gainCents < 0 ? '' : '+'} />
              </dd>
            )}
          </div>
        ))}
      </dl>

      {otherCurrencies.length > 0 && (
        <p className="mt-3 text-xs text-neutral-500">
          {t('finance.otherCurrencies', {
            amounts: otherCurrencies.map(([code, cents]) => (privacyOn ? PRIVACY_MASK : formatMoney(cents, code, lang))).join(', '),
          })}
        </p>
      )}
    </Card>
  );
}
