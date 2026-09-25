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
