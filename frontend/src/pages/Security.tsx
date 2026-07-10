import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import LoadingState from '../components/UI/LoadingState';
import ErrorState from '../components/UI/ErrorState';
import SecurityStatsCards from '../components/Security/SecurityStatsCards';
import SecurityLogsFilters from '../components/Security/SecurityLogsFilters';
import SecurityLogsTable from '../components/Security/SecurityLogsTable';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useSecurityLogsPage } from '../hooks/useSecurityLogsPage';

export default function Security() {
  useDocumentTitle('Security Logs');
  const {
    logs,
    total,
    skip,
    pageSize,
    stats,
    filters,
    setFilters,
    clearFilters,
    isLoading,
    error,
    isPurging,
    goToNextPage,
    goToPrevPage,
    handlePurge,
  } = useSecurityLogsPage();

  return (
    <PageLayout>
      <PageHeader
        title="Security Logs"
        description="Area exclusive to Administrators. Every request blocked by the rate limiter (a candidate DoS/brute-force attempt) is recorded here, with the offending IP, path, and user (if authenticated)."
      />

      <SecurityStatsCards stats={stats} />

      <SecurityLogsFilters
        filters={filters}
        onChange={setFilters}
        onClear={clearFilters}
        onPurge={handlePurge}
        isPurging={isPurging}
      />

      {isLoading ? (
        <LoadingState message="Loading security logs..." />
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <SecurityLogsTable
          logs={logs}
          total={total}
          skip={skip}
          pageSize={pageSize}
          onNextPage={goToNextPage}
          onPrevPage={goToPrevPage}
        />
      )}
    </PageLayout>
  );
}
