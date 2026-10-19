import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import ErrorState from '../components/UI/ErrorState';
import FeedbackBanner from '../components/UI/FeedbackBanner';
import TableSkeleton from '../components/UI/TableSkeleton';
import AppealsList from '../components/Appeals/AppealsList';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useAppealsPage } from '../hooks/useAppealsPage';
import { useI18n } from '../i18n/useI18n';

export default function Appeals() {
  const { t } = useI18n();
  useDocumentTitle('Appeals');
  const {
    appeals,
    total,
    skip,
    pageSize,
    isLoading,
    error,
    feedback,
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

      <FeedbackBanner feedback={feedback} className="mb-4" />

      {isLoading ? (
        <TableSkeleton rows={4} columns={1} />
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <AppealsList
          appeals={appeals}
          total={total}
          skip={skip}
          pageSize={pageSize}
          onResolve={handleResolve}
          onNextPage={goToNextPage}
          onPrevPage={goToPrevPage}
        />
      )}
    </PageLayout>
  );
}
