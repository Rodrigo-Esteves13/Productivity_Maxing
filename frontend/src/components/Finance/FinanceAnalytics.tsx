import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import Card from '../UI/Card';
import EmptyState from '../UI/EmptyState';
import ErrorState from '../UI/ErrorState';
import ProgressBar from '../UI/ProgressBar';
import SegmentedControl from '../UI/SegmentedControl';
import Skeleton from '../UI/Skeleton';
import type { AnalyticsGranularity, FinanceAnalytics as FinanceAnalyticsData } from '../../api/financeService';
import { useFinanceAnalytics } from '../../hooks/useFinanceAnalytics';
import {
  AXIS_COLOR,
  EXPENSE_COLOR,
  GRID_COLOR,
  INCOME_COLOR,
  PROJECTED_OPACITY,
  SOLID_OPACITY,
  buildCategorySlices,
  OTHER_KEY,
} from '../../lib/financeChart';
import Money, { PrivateText } from './Money';
import { formatBucketLabel } from '../../lib/money';
import { useMoneyText, usePrivacyMode } from '../../hooks/usePrivacyMode';
import { useI18n } from '../../i18n/useI18n';

const RANGE_MONTHS = [3, 6, 12] as const;
const DEFAULT_MONTHS: Record<AnalyticsGranularity, number> = { month: 6, week: 3 };
const BAR_CHART_HEIGHT_CLASS = 'h-64';
const DONUT_SIZE_CLASS = 'h-48 w-48';
const DONUT_INNER_RADIUS = '60%';
const DONUT_OUTER_RADIUS = '100%';
const SLICE_GAP_PX = 2;
const AXIS_FONT_SIZE = 11;
const Y_AXIS_WIDTH = 48;

interface FinanceAnalyticsProps {
  /** Muda quando os dados do mes mudam, para os graficos acompanharem. */
  refreshKey: number;
  currency: string;
}

interface ChartRow {
  key: string;
  label: string;
  incomeActual: number;
  incomeProjected: number;
  expenseActual: number;
  expenseProjected: number;
}

interface TooltipEntry {
  payload?: ChartRow;
}

function ChartSkeleton() {
  return (
    <div aria-hidden="true" aria-busy="true" className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
      </div>
      <Skeleton className={`${BAR_CHART_HEIGHT_CLASS} w-full`} />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

// Analitica por semana ou mes: receitas vs despesas, gasto por categoria e
// subscricoes. As barras mais claras sao valores ainda por acontecer.
export default function FinanceAnalytics({ refreshKey, currency }: FinanceAnalyticsProps) {
  const { t, lang } = useI18n();
  const [granularity, setGranularity] = useState<AnalyticsGranularity>('month');
  const [months, setMonths] = useState<number>(DEFAULT_MONTHS.month);
  const { data, error } = useFinanceAnalytics(granularity, months, refreshKey);
  const moneyText = useMoneyText();
  const money = (cents: number) => moneyText(cents, data?.currency ?? currency);
  const compact = useMemo(() => new Intl.NumberFormat(lang, { notation: 'compact' }), [lang]);

  const changeGranularity = (next: AnalyticsGranularity) => {
    setGranularity(next);
    setMonths(DEFAULT_MONTHS[next]);
  };

  return (
    <Card className="mb-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-neutral-200">{t('finance.analytics')}</h3>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            options={[
              { value: 'week', label: t('finance.byWeek') },
              { value: 'month', label: t('finance.byMonth') },
            ]}
            value={granularity}
            onChange={changeGranularity}
            size="sm"
          />
          <SegmentedControl
            options={RANGE_MONTHS.map((m) => ({ value: String(m), label: t('finance.rangeMonths', { count: m }) }))}
            value={String(months)}
            onChange={(next) => setMonths(Number(next))}
            size="sm"
          />
        </div>
      </div>

      {error && !data ? (
        <ErrorState message={t('finance.analyticsError')} />
      ) : !data ? (
        <ChartSkeleton />
      ) : (
        <AnalyticsBody data={data} granularity={data.granularity} money={money} compact={(cents) => compact.format(cents / 100)} />
      )}
    </Card>
  );
}

interface AnalyticsBodyProps {
  data: FinanceAnalyticsData;
  granularity: AnalyticsGranularity;
  money: (cents: number) => string;
  compact: (cents: number) => string;
}

function AnalyticsBody({ data, granularity, money, compact }: AnalyticsBodyProps) {
  const { t, lang } = useI18n();
  const { enabled: privacyOn } = usePrivacyMode();
  const { currency } = data;
  const rows = useMemo<ChartRow[]>(
    () =>
      data.series.map((b) => ({
        key: b.key,
        label: formatBucketLabel(b.key, granularity, lang),
        incomeActual: b.incomeCents - b.projectedIncomeCents,
        incomeProjected: b.projectedIncomeCents,
        expenseActual: b.expenseCents - b.projectedExpenseCents,
        expenseProjected: b.projectedExpenseCents,
      })),
    [data.series, granularity, lang],
  );
  const slices = useMemo(() => buildCategorySlices(data.series), [data.series]);
  const categoryName = (key: string) => (key === OTHER_KEY ? t('finance.otherGroup') : t(`finance.cat.${key}`));
  const hasData = data.totals.incomeCents > 0 || data.totals.expenseCents > 0;
  const totalSpent = slices.reduce((sum, s) => sum + s.cents, 0);

  if (!hasData && data.subscriptions.items.length === 0) {
    return <EmptyState variant="inline" message={t('finance.analyticsEmpty')} />;
  }

  const renderTooltip = ({ active, payload }: { active?: boolean; payload?: readonly TooltipEntry[] }) => {
    const row = active ? payload?.[0]?.payload : undefined;
    if (!row) return null;
    return (
      <div className="rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-xs shadow-2xl">
        <p className="mb-1 font-medium text-neutral-200">{row.label}</p>
        <p className="tabular-nums text-cyan-400">
          {t('finance.income')}: {money(row.incomeActual + row.incomeProjected)}
        </p>
        <p className="tabular-nums text-red-400">
          {t('finance.expenses')}: {money(row.expenseActual + row.expenseProjected)}
        </p>
        {(row.incomeProjected > 0 || row.expenseProjected > 0) && (
          <p className="mt-1 text-neutral-500">{t('finance.includesProjected')}</p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-3 gap-3 text-center">
        {[
          { label: t('finance.income'), value: data.totals.incomeCents, tone: 'text-cyan-400' },
          { label: t('finance.expenses'), value: data.totals.expenseCents, tone: 'text-red-400' },
          { label: t('finance.net'), value: data.totals.netCents, tone: data.totals.netCents < 0 ? 'text-red-400' : 'text-white' },
        ].map((item) => (
          <div key={item.label} className="rounded-lg bg-neutral-800/50 p-2">
            <dt className="text-xs text-neutral-400">{item.label}</dt>
            <dd className={`text-base font-semibold tabular-nums sm:text-lg ${item.tone}`}>
              <Money cents={item.value} currency={currency} />
            </dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="finance-flow-title">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h4 id="finance-flow-title" className="text-sm font-semibold text-neutral-200">
            {t('finance.incomeVsExpenses')}
          </h4>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-400">
            <li className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-cyan-400" aria-hidden="true" />
              {t('finance.income')}
            </li>
            <li className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-red-400" aria-hidden="true" />
              {t('finance.expenses')}
            </li>
            <li className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm border border-dashed border-neutral-400 opacity-60" aria-hidden="true" />
              {t('finance.projected')}
            </li>
          </ul>
        </div>
        <div className={`${BAR_CHART_HEIGHT_CLASS} w-full`} aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={SLICE_GAP_PX}>
              <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: AXIS_COLOR, fontSize: AXIS_FONT_SIZE }} axisLine={{ stroke: GRID_COLOR }} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: AXIS_COLOR, fontSize: AXIS_FONT_SIZE }} axisLine={false} tickLine={false} width={Y_AXIS_WIDTH} tickFormatter={compact} hide={privacyOn} />
              <Tooltip content={renderTooltip} cursor={{ fill: GRID_COLOR, fillOpacity: 0.4 }} />
              <Bar dataKey="incomeActual" stackId="income" fill={INCOME_COLOR} fillOpacity={SOLID_OPACITY} isAnimationActive={false} />
              <Bar dataKey="incomeProjected" stackId="income" fill={INCOME_COLOR} fillOpacity={PROJECTED_OPACITY} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="expenseActual" stackId="expense" fill={EXPENSE_COLOR} fillOpacity={SOLID_OPACITY} isAnimationActive={false} />
              <Bar dataKey="expenseProjected" stackId="expense" fill={EXPENSE_COLOR} fillOpacity={PROJECTED_OPACITY} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <table className="sr-only">
          <caption>{t('finance.incomeVsExpenses')}</caption>
          <thead>
            <tr>
              <th scope="col">{data.granularity === 'week' ? t('finance.byWeek') : t('finance.byMonth')}</th>
              <th scope="col">{t('finance.income')}</th>
              <th scope="col">{t('finance.expenses')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <th scope="row">{row.label}</th>
                <td>{money(row.incomeActual + row.incomeProjected)}</td>
                <td>{money(row.expenseActual + row.expenseProjected)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="finance-cat-title">
        <h4 id="finance-cat-title" className="mb-2 text-sm font-semibold text-neutral-200">
          {t('finance.spendingByCategory')}
        </h4>
        {slices.length === 0 ? (
          <EmptyState variant="inline" message={t('finance.noSpending')} />
        ) : (
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <div className={`${DONUT_SIZE_CLASS} shrink-0`} aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={slices} dataKey="cents" nameKey="key" innerRadius={DONUT_INNER_RADIUS} outerRadius={DONUT_OUTER_RADIUS} paddingAngle={SLICE_GAP_PX} stroke="none" isAnimationActive={false}>
                    {slices.map((s) => (
                      <Cell key={s.key} fill={s.swatch.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      const slice = active ? (payload?.[0]?.payload as { key: string; cents: number } | undefined) : undefined;
                      if (!slice) return null;
                      return (
                        <div className="rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-xs shadow-2xl">
                          <p className="font-medium text-neutral-200">{categoryName(slice.key)}</p>
                          <p className="tabular-nums text-neutral-300">
                            <Money cents={slice.cents} currency={currency} />
                          </p>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="w-full min-w-0 flex-1 space-y-2 text-sm">
              {slices.map((s) => {
                const share = totalSpent > 0 ? (s.cents / totalSpent) * 100 : 0;
                return (
                  <li key={s.key}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2 text-neutral-300">
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${s.swatch.dotClass}`} aria-hidden="true" />
                        <span className="truncate">{categoryName(s.key)}</span>
                      </span>
                      <span className="tabular-nums text-neutral-200">
                        <Money cents={s.cents} currency={currency} />
                        <span className="ml-2 text-xs text-neutral-500">{Math.round(share)}%</span>
                      </span>
                    </div>
                    <ProgressBar percent={share} fillClassName={s.swatch.dotClass} className="mt-1" />
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      <section aria-labelledby="finance-subs-title">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h4 id="finance-subs-title" className="text-sm font-semibold text-neutral-200">
            {t('finance.subscriptions')}
          </h4>
          {data.subscriptions.items.length > 0 && (
            <p className="text-sm tabular-nums text-neutral-300">
              <PrivateText render={(m) => t('finance.subscriptionsMonthly', { amount: m(data.subscriptions.monthlyTotalCents, currency) })} />
            </p>
          )}
        </div>
        {data.subscriptions.items.length === 0 ? (
          <EmptyState variant="inline" message={t('finance.noSubscriptions')} />
        ) : (
          <ul className="divide-y divide-neutral-800">
            {data.subscriptions.items.map((sub) => (
              <li key={sub.entryId} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-neutral-200">{sub.note ?? t('finance.cat.SUBSCRIPTIONS')}</p>
                  <p className="text-xs text-neutral-500">
                    {t(`finance.freq.${sub.frequency}`)}
                    {sub.nextDate && ` · ${t('finance.nextCharge', { date: new Date(`${sub.nextDate}T00:00:00`).toLocaleDateString(lang) })}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm tabular-nums text-neutral-200">
                    <Money cents={sub.amountCents} currency={currency} />
                  </p>
                  {sub.frequency !== 'MONTHLY' && (
                    <p className="text-xs tabular-nums text-neutral-500"><PrivateText render={(m) => t('finance.perMonth', { amount: m(sub.monthlyCostCents, currency) })} />
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
