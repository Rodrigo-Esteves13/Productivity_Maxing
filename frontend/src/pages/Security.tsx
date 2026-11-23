import { useMemo, useState } from 'react';
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
import { useI18n } from '../i18n/useI18n';

export default function Security() {
  const { t } = useI18n();
  useDocumentTitle(t('ui.securityLogsTitle'));
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
    refresh,
  } = useSecurityLogsPage();

  // Uma so instancia, partilhada: o cartao de IPs banidos escreve nela e a
  // tabela de logs le dela (o selo "banned" atualiza logo, sem refresh).
  const banned = useBannedIps();
  const bannedIpSet = useMemo(() => new Set(banned.bannedIps.map((b) => b.ip)), [banned.bannedIps]);

  // Clicar "Ban" numa linha da tabela só preenche o campo do
  // BannedIpsCard - o admin ainda confirma (e pode acrescentar um
  // motivo) antes de o ban ser efetivo. Cada pedido e um objeto novo (mesmo
  // com o mesmo IP), por isso o useEffect do card corre sempre, sem remontar.
  const [banRequest, setBanRequest] = useState<{ ip: string }>({ ip: '' });
  const requestBan = (ip: string) => setBanRequest({ ip });

  return (
    <PageLayout>
      <PageHeader
        title={t('ui.securityLogs')}
        description={t('ui.areaExclusiveToAdministratorsEvery')}
      />

      <SecurityStatsCards stats={stats} />

      <BannedIpsCard banned={banned} prefill={banRequest} />

      <SecurityLogsFilters
        filters={filters}
        onChange={setFilters}
        onClear={clearFilters}
        onPurge={handlePurge}
        isPurging={isPurging}
        onRefresh={refresh}
        logs={logs}
      />

      {isLoading ? (
        <TableSkeleton rows={8} columns={5} />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
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
