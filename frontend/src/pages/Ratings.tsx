import type { ReactNode } from 'react';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import EmptyState from '../components/UI/EmptyState';
import ErrorState from '../components/UI/ErrorState';
import TableSkeleton from '../components/UI/TableSkeleton';
import Button from '../components/UI/Button';
import PrefetchLink from '../components/UI/PrefetchLink';
import QuadrantGrid from '../components/Ratings/QuadrantGrid';
import CorrelationList from '../components/Ratings/CorrelationList';
import CoursesTable from '../components/Ratings/CoursesTable';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useRatingStats } from '../hooks/useRatingStats';
import { formatNumber, formatPercent, ratedCourseCount } from '../lib/ratings';
import { useI18n } from '../i18n/useI18n';
import type { RatingStats } from '../types/models';

function Section({ title, children, note }: { title: string; children: ReactNode; note?: string }) {
  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 sm:p-5">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {note && <p className="mb-4 mt-1 text-xs text-neutral-500">{note}</p>}
      {!note && <div className="mb-3" />}
      {children}
    </section>
  );
}

function ByTeacherList({ stats }: { stats: RatingStats }) {
  const { t, lang } = useI18n();
  const dash = t('ratings.none');
  return (
    <ul className="divide-y divide-neutral-800/60">
      {stats.byTeacher.map((row) => (
        <li key={row.teacherName} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2 text-sm">
          <span className="min-w-0 truncate text-neutral-200">{row.teacherName}</span>
          <span className="text-xs tabular-nums text-neutral-400">
            {t('ratings.byTeacher.row', {
              courses: formatNumber(row.courses, lang, 0),
              rating: row.avgRating === null ? dash : formatNumber(row.avgRating, lang, 1),
              grade: row.avgGradeFraction === null ? dash : formatPercent(row.avgGradeFraction, lang),
            })}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Content({ stats }: { stats: RatingStats }) {
  const { t } = useI18n();
  if (stats.courses.length === 0) {
    return (
      <EmptyState
        message={t('ratings.empty')}
        action={
          <PrefetchLink to="/areas" className="text-sm text-violet-400 underline hover:text-violet-300">
            {t('ratings.emptyAction')}
          </PrefetchLink>
        }
      />
    );
  }
  const hasRatings = ratedCourseCount(stats.courses) > 0;
  return (
    <div className="space-y-6">
      <Section title={t('ratings.section.courses')}>
        <CoursesTable courses={stats.courses} />
      </Section>
      {!hasRatings ? (
        <EmptyState
          variant="inline"
          message={t('ratings.noRatings')}
          action={
            <PrefetchLink to="/areas" className="text-sm text-violet-400 underline hover:text-violet-300">
              {t('ratings.emptyAction')}
            </PrefetchLink>
          }
        />
      ) : (
        <>
          <Section title={t('ratings.section.quadrants')} note={t('ratings.quadrant.legend')}>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <QuadrantGrid title={t('ratings.teacher')} quadrants={stats.quadrants.teacher} />
              <QuadrantGrid title={t('ratings.course')} quadrants={stats.quadrants.course} />
            </div>
          </Section>
          <Section title={t('ratings.section.correlations')} note={t('ratings.corr.note')}>
            <CorrelationList stats={stats} />
          </Section>
          <Section title={t('ratings.section.byTeacher')}>
            {stats.byTeacher.length === 0 ? (
              <EmptyState variant="inline" message={t('ratings.byTeacher.empty')} />
            ) : (
              <ByTeacherList stats={stats} />
            )}
          </Section>
        </>
      )}
      <p className="text-xs text-neutral-500">{t('ratings.disclaimer')}</p>
    </div>
  );
}

// Estatistica das avaliacoes privadas de docente e cadeira, do periodo
// escolhido no topo (ou de todos na vista agregada).
export default function Ratings() {
  const { t } = useI18n();
  useDocumentTitle(t('ratings.title'));
  const { stats, isLoading, hasError, retry } = useRatingStats();

  const body = (() => {
    if (isLoading) return <TableSkeleton />;
    if (!hasError && !stats) {
      return (
        <EmptyState
          message={t('ratings.empty')}
          action={
            <PrefetchLink to="/areas" className="text-sm text-violet-400 underline hover:text-violet-300">
              {t('ratings.emptyAction')}
            </PrefetchLink>
          }
        />
      );
    }
    if (hasError || !stats) {
      return (
        <div className="space-y-3">
          <ErrorState message={t('ratings.loadError')} />
          <Button size="sm" variant="secondary" onClick={retry}>
            {t('ratings.card.retry')}
          </Button>
        </div>
      );
    }
    return <Content stats={stats} />;
  })();

  return (
    <PageLayout>
      <PageHeader title={t('ratings.title')} description={t('ratings.description')} />
      {body}
    </PageLayout>
  );
}
