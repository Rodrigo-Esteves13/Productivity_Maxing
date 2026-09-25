import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import ErrorState from '../components/UI/ErrorState';
import TableSkeleton from '../components/UI/TableSkeleton';
import AppealsList from '../components/Appeals/AppealsList';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useAppealsPage } from '../hooks/useAppealsPage';

export default function Appeals() {
  useDocumentTitle('Appeals');
  const {
    appeals,
    total,
    skip,
    pageSize,
    isLoading,
    error,
    resolvingId,
    feedback,
    goToNextPage,
    goToPrevPage,
    handleResolve,
  } = useAppealsPage();

  return (
    <PageLayout>
      <PageHeader
        title="Appeals"
        description="Suspended and banned users waiting on a decision, most recently submitted first."
      />

      {feedback && (
        <div
          className={`mb-4 rounded-lg border p-3 text-sm ${
            feedback.type === 'success'
              ? 'border-emerald-800 bg-emerald-950/50 text-emerald-300'
              : 'border-red-500 bg-red-900/50 text-red-200'
          }`}
        >
          {feedback.message}
        </div>
      )}

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
          resolvingId={resolvingId}
          onResolve={handleResolve}
          onNextPage={goToNextPage}
          onPrevPage={goToPrevPage}
        />
      )}
    </PageLayout>
  );
}
