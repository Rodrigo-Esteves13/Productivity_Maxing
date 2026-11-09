import { useMemo, useState, type ComponentType } from 'react';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import Select from '../components/UI/Select';
import EmptyState from '../components/UI/EmptyState';
import ErrorState from '../components/UI/ErrorState';
import CardGridSkeleton from '../components/UI/CardGridSkeleton';
import {
  CheckIcon,
  ClockIcon,
  CalendarIcon,
  GraduationCapIcon,
  TrendingUpIcon,
  FlameIcon,
} from '../components/UI/Icons';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { usePeriodReportCard } from '../hooks/usePeriodReportCard';
import { usePeriodReview } from '../hooks/usePeriodReview';
import { useAcademic } from '../context/useAcademic';
import { formatDayLabel, formatDuration, weekdayLabel } from '../lib/timeFormat';
import type { PeriodReviewCard } from '../lib/periodReview';
import { useI18n } from '../i18n/useI18n';

interface CardView {
  Icon: ComponentType<{ className?: string }>;
  value: string;
  label: string;
  detail: string;
}

const ICON_CLASS = 'h-5 w-5 text-violet-400';

function useCardView() {
  const { t, lang } = useI18n();
  return (card: PeriodReviewCard): CardView => {
    switch (card.kind) {
      case 'tasksCompleted':
        return { Icon: CheckIcon, value: String(card.count), label: t('periodReview.tasks.label'), detail: t('periodReview.tasks.detail') };
      case 'studyTime':
        return {
          Icon: ClockIcon,
          value: formatDuration(card.minutes),
          label: t('periodReview.study.label'),
          detail: t('periodReview.study.detail', { n: card.sessionCount }),
        };
      case 'bestDay':
        return {
          Icon: CalendarIcon,
          value: formatDuration(card.minutes),
          label: t('periodReview.bestDay.label'),
          detail: formatDayLabel(card.dayKey),
        };
      case 'bestArea':
        return {
          Icon: GraduationCapIcon,
          value: String(card.average),
          label: t('periodReview.bestArea.label'),
          detail: card.areaName,
        };
      case 'bestWeekday':
        return {
          Icon: TrendingUpIcon,
          value: weekdayLabel(card.weekday, lang),
          label: t('periodReview.weekday.label'),
          detail: t('periodReview.weekday.detail', { time: formatDuration(card.minutes) }),
        };
      case 'longestStreak':
        return {
          Icon: FlameIcon,
          value: String(card.days),
          label: t('periodReview.streak.label'),
          detail: t('periodReview.streak.detail'),
        };
    }
  };
}

function StatCard({ view }: { view: CardView }) {
  const { Icon } = view;
  return (
    <section className="flex min-h-[14rem] flex-col justify-center rounded-2xl border border-neutral-800 bg-neutral-900/40 p-8">
      <Icon className={ICON_CLASS} />
      <p className="mt-4 text-sm uppercase tracking-wide text-neutral-500">{view.label}</p>
      <p className="mt-2 text-6xl font-bold text-white sm:text-7xl">{view.value}</p>
      <p className="mt-3 text-base text-violet-300">{view.detail}</p>
    </section>
  );
}

// "Spotify Wrapped" do periodo: um scroll de cartoes grandes, so com os
// dados que existem (cartoes sem dados nao aparecem).
export default function PeriodReview() {
  const { t } = useI18n();
  useDocumentTitle(t('periodReview.title'));
  const { periods, activePeriod, isLoading: academicLoading } = useAcademic();
  const [chosenId, setChosenId] = useState<string | null>(null);
  const periodId = chosenId ?? activePeriod?.id ?? periods[0]?.id ?? null;
  const { card, isLoading: cardLoading, error: cardError } = usePeriodReportCard(periodId);
  const { cards, isLoading, error } = usePeriodReview(periodId, card);
  const toView = useCardView();
  const views = useMemo(() => cards.map((c) => ({ key: c.kind, view: toView(c) })), [cards, toView]);

  const action =
    periods.length > 1 ? (
      <Select
        id="period-review-period"
        aria-label={t('periodReview.period')}
        value={periodId ?? ''}
        onChange={(e) => setChosenId(e.target.value)}
      >
        {periods.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </Select>
    ) : undefined;

  const body = (() => {
    if (academicLoading || ((isLoading || cardLoading) && periodId)) return <CardGridSkeleton cards={3} />;
    if (!periodId) return <EmptyState message={t('periodReview.noPeriod')} />;
    if (error || cardError) return <ErrorState message={t('periodReview.loadError')} />;
    if (views.length === 0) return <EmptyState message={t('periodReview.empty')} />;
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        {views.map(({ key, view }) => (
          <StatCard key={key} view={view} />
        ))}
      </div>
    );
  })();

  return (
    <PageLayout>
      <PageHeader title={t('periodReview.title')} description={t('periodReview.description')} action={action} />
      {body}
    </PageLayout>
  );
}
