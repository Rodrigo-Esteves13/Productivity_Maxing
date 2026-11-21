import { useEffect, useMemo, useState } from 'react';
import Card from '../UI/Card';
import ProgressBar from '../UI/ProgressBar';
import type { FinanceSummary } from '../../api/financeService';
import { PrivateText } from './Money';
import { usePrivacyMode } from '../../hooks/usePrivacyMode';
import { useNoLeisureGoalPref } from '../../hooks/useNoLeisureGoalPref';
import { PRIVACY_MASK } from '../../lib/privacy';
import { todayKey } from '../../lib/dateKey';
import { FULL_PERCENT } from '../../lib/percent';
import {
  computeNoLeisureDays,
  MAX_NO_LEISURE_GOAL,
  MIN_DAYS_FOR_STREAK,
  MIN_NO_LEISURE_GOAL,
  type NoLeisureDayStatus,
} from '../../lib/noLeisureDays';
import { useI18n } from '../../i18n/useI18n';

const DOT_CLASS: Record<NoLeisureDayStatus, string> = {
  free: 'bg-violet-500 border-violet-500',
  spent: 'border-neutral-400',
  future: 'border-dashed border-neutral-600',
};
const DOT_LABEL_KEY: Record<NoLeisureDayStatus, string> = {
  spent: 'financeNoSpend.dotSpent',
  free: 'financeNoSpend.dotFree',
  future: 'financeNoSpend.dotFuture',
};
const STEP_BUTTON_CLASS =
  'h-11 w-11 sm:h-8 sm:w-8 rounded-lg bg-neutral-800 text-sm text-neutral-200 hover:bg-neutral-700 disabled:opacity-40 disabled:hover:bg-neutral-800';
// Marca o lugar do numero numa frase traduzida, para so o numero ficar em PrivateText.
const NUMBER_SLOT = '';

interface NoLeisureDaysCardProps {
  summary: FinanceSummary;
}

// Mini desafio do mes: dias sem nenhum gasto de lazer. Sem culpa: dias com
// lazer sao so dias com lazer, nao falhas.
export default function NoLeisureDaysCard({ summary }: NoLeisureDaysCardProps) {
  const { t } = useI18n();
  const { enabled: privacyOn } = usePrivacyMode();
  const { goal, setGoal } = useNoLeisureGoalPref();
  const { month, occurrences, entries } = summary;
  const [today, setToday] = useState(() => todayKey());
  // O dia local pode mudar com o separador aberto: refresca ao voltar a ele.
  useEffect(() => {
    const refresh = () => setToday(todayKey());
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  const result = useMemo(
    () => computeNoLeisureDays(month, occurrences, entries, new Date()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [month, occurrences, entries, today],
  );
  const { days, totalDays, elapsedDays, freeDays, currentStreak, bestStreak } = result;
  const notStarted = elapsedDays === 0;
  const isPast = !notStarted && days[days.length - 1].key < today;
  const showStreaks = elapsedDays >= MIN_DAYS_FOR_STREAK;
  const maxGoal = Math.min(MAX_NO_LEISURE_GOAL, totalDays);
  const shownGoal = Math.min(goal, maxGoal);
  const reached = !privacyOn && freeDays >= shownGoal;
  const dotsSummary = t('financeNoSpend.dotsSummary', {
    free: String(days.filter((d) => d.status === 'free').length),
    spent: String(days.filter((d) => d.status === 'spent').length),
    future: String(days.filter((d) => d.status === 'future').length),
  });
  // Frase traduzida com so o numero mascarado em privacidade (o resto continua legivel).
  const withNumber = (value: number, template: (slot: string) => string) => {
    const [before, after = ''] = template(NUMBER_SLOT).split(NUMBER_SLOT);
    return (
      <>
        {before}
        <PrivateText render={(_money, masked) => (masked ? PRIVACY_MASK : String(value))} />
        {after}
      </>
    );
  };
  const daysText = (value: number) =>
    withNumber(value, (n) => t(value === 1 ? 'financeNoSpend.daysOne' : 'financeNoSpend.daysOther', { n }));

  return (
    <Card className="mb-6">
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-neutral-200">{t('financeNoSpend.title')}</h3>
        {!result.hasData && !notStarted ? (
          <p className="text-sm text-neutral-400">{t('financeNoSpend.empty')}</p>
        ) : (
          <>
            {elapsedDays > 0 && (
              <p className="text-sm text-neutral-300">
                {withNumber(freeDays, (free) =>
                  t('financeNoSpend.summary', { free, total: String(elapsedDays) }),
                )}
              </p>
            )}
            {!privacyOn && (
              <div role="img" aria-label={`${t('financeNoSpend.dotsLabel')}. ${dotsSummary}`} className="flex flex-wrap gap-1">
                {days.map((d) => (
                  <span
                    key={d.key}
                    aria-hidden="true"
                    title={t(DOT_LABEL_KEY[d.status], { day: String(d.day) })}
                    className={`h-3 w-3 rounded-full border ${DOT_CLASS[d.status]}`}
                  />
                ))}
              </div>
            )}
            {notStarted ? (
              <p className="text-xs text-neutral-400">{t('financeNoSpend.monthNotStarted')}</p>
            ) : (
              <>
                {showStreaks ? (
                  <dl className={`grid gap-3 text-center ${isPast ? 'grid-cols-1' : 'grid-cols-2'}`}>
                    {!isPast && (
                      <div className="rounded-lg bg-neutral-800/50 p-2">
                        <dt className="text-xs text-neutral-400">{t('financeNoSpend.currentStreak')}</dt>
                        <dd className="text-base font-semibold tabular-nums text-violet-400">{daysText(currentStreak)}</dd>
                      </div>
                    )}
                    <div className="rounded-lg bg-neutral-800/50 p-2">
                      <dt className="text-xs text-neutral-400">{t('financeNoSpend.bestStreak')}</dt>
                      <dd className="text-base font-semibold tabular-nums text-white">{daysText(bestStreak)}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="text-xs text-neutral-500">{t('financeNoSpend.earlyHint')}</p>
                )}
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-neutral-300">
                      {t('financeNoSpend.goalLabel', { goal: String(shownGoal) })}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className={STEP_BUTTON_CLASS}
                        aria-label={t('financeNoSpend.goalDecrease')}
                        disabled={shownGoal <= MIN_NO_LEISURE_GOAL}
                        onClick={() => setGoal(shownGoal - 1)}
                      >
                        -
                      </button>
                      <button
                        type="button"
                        className={STEP_BUTTON_CLASS}
                        aria-label={t('financeNoSpend.goalIncrease')}
                        disabled={shownGoal >= maxGoal}
                        onClick={() => setGoal(shownGoal + 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  {!privacyOn && (
                    <ProgressBar
                      percent={(freeDays / shownGoal) * FULL_PERCENT}
                      fillClassName={reached ? 'bg-amber-500' : 'bg-violet-500'}
                      thickness="md"
                      className="mt-2"
                      label={t('financeNoSpend.goalLabel', { goal: String(shownGoal) })}
                    />
                  )}
                  <p className={`mt-1 text-xs ${reached ? 'text-amber-400' : 'text-neutral-400'}`}>
                    {withNumber(freeDays, (free) =>
                      t('financeNoSpend.goalProgress', { free, goal: String(shownGoal) }),
                    )}
                    {reached ? ` ${t('financeNoSpend.goalReached')}` : ''}
                  </p>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
