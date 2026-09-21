import { useState } from 'react';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import ErrorState from '../components/UI/ErrorState';
import TableSkeleton from '../components/UI/TableSkeleton';
import SecurityStatsCards from '../components/Security/SecurityStatsCards';
import SecurityLogsFilters from '../components/Security/SecurityLogsFilters';
import SecurityLogsTable from '../components/Security/SecurityLogsTable';
import BannedIpsCard from '../components/Security/BannedIpsCard';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useSecurityLogsPage } from '../hooks/useSecurityLogsPage';
import { useBannedIps } from '../hooks/useBannedIps';

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

  // Só para saber quais já estão banidos (mostrar "banned" em vez do
  // botão "Ban" na tabela de logs) - o ban em si vive todo dentro do
  // BannedIpsCard, que tem a sua própria instância de useBannedIps.
  const { bannedIps } = useBannedIps();
  const bannedIpSet = new Set(bannedIps.map((b) => b.ip));

  // Clicar "Ban" numa linha da tabela só preenche o campo do
  // BannedIpsCard - o admin ainda confirma (e pode acrescentar um
  // motivo) antes de o ban ser efetivo. Um valor novo (mesmo repetido)
  // tem de disparar o useEffect do card outra vez, daí o contador.
  const [banRequest, setBanRequest] = useState({ ip: '', nonce: 0 });
  const requestBan = (ip: string) => setBanRequest((prev) => ({ ip, nonce: prev.nonce + 1 }));

  return (
    <PageLayout>
      <PageHeader
        title="Security Logs"
        description="Area exclusive to Administrators. Every request blocked by the rate limiter (a candidate DoS/brute-force attempt) is recorded here, with the offending IP, path, and user (if authenticated)."
      />

      <SecurityStatsCards stats={stats} />

      <BannedIpsCard key={banRequest.nonce} prefillIp={banRequest.ip} />

      <SecurityLogsFilters
        filters={filters}
        onChange={setFilters}
        onClear={clearFilters}
        onPurge={handlePurge}
        isPurging={isPurging}
      />

      {isLoading ? (
        <TableSkeleton rows={8} columns={5} />
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
          onBanIp={requestBan}
          bannedIpSet={bannedIpSet}
        />
      )}
    </PageLayout>
  );
}
