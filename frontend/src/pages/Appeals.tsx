import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import ErrorState from '../components/UI/ErrorState';
import FeedbackBanner from '../components/UI/FeedbackBanner';
import TabBar from '../components/UI/TabBar';
import TableSkeleton from '../components/UI/TableSkeleton';
import AppealsList from '../components/Appeals/AppealsList';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useAppealsPage, type AppealsView } from '../hooks/useAppealsPage';
import { useI18n } from '../i18n/useI18n';

export default function Appeals() {
  const { t } = useI18n();
  useDocumentTitle(t('nav.admin.appeals'));
  const {
    appeals,
    total,
    skip,
    pageSize,
    isLoading,
    error,
    feedback,
    view,
    changeView,
    retry,
    goToNextPage,
    goToPrevPage,
    handleResolve,
  } = useAppealsPage();

  return (
    <PageLayout>
      <PageHeader
        title={t('ui.appeals')}
        description={t('ui.suspendedAndBannedUsersWaiting')}
      />

      <TabBar<AppealsView>
        label={t('nav.admin.appeals')}
        value={view}
        onChange={changeView}
        className="mb-4"
        items={[
          { value: 'pending', label: t('quickWins.appealsTabPending') },
          { value: 'history', label: t('quickWins.appealsTabHistory') },
        ]}
      />

      <FeedbackBanner feedback={feedback} className="mb-4" />

      {isLoading ? (
        <TableSkeleton rows={4} columns={1} />
      ) : error ? (
        <ErrorState message={error} onRetry={retry} />
      ) : (
        <AppealsList
          appeals={appeals}
          total={total}
          skip={skip}
          pageSize={pageSize}
          onResolve={handleResolve}
          readOnly={view === 'history'}
          onNextPage={goToNextPage}
          onPrevPage={goToPrevPage}
        />
      )}
    </PageLayout>
  );
}
