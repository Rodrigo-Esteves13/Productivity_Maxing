import { lazy, Suspense } from 'react';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import Button from '../components/UI/Button';
import ErrorState from '../components/UI/ErrorState';
import EmptyState from '../components/UI/EmptyState';
import CardGridSkeleton from '../components/UI/CardGridSkeleton';
import AreaProposalsPanel from '../components/Areas/AreaProposalsPanel';
import AreaToolbar from '../components/Areas/AreaToolbar';
import AreaSummaryStrip, { AreaSummaryStripSkeleton } from '../components/Areas/AreaSummaryStrip';
import { AreaOverviewContext } from '../components/Areas/areaOverviewContext';
import AreaHeaderActions from '../components/Areas/page/AreaHeaderActions';
import PersonalAreasSection from '../components/Areas/page/PersonalAreasSection';
import OfficialAreasSection from '../components/Areas/page/OfficialAreasSection';
import AreaSelectionBar from '../components/Areas/page/AreaSelectionBar';
import AreaModals from '../components/Areas/page/AreaModals';
import { HEADER_BUTTON_CLASS } from '../components/Areas/page/areaPageClasses';
import Skeleton from '../components/UI/Skeleton';
import { useAreasView } from '../hooks/useAreasView';
import { useI18n } from '../i18n/useI18n';

const ApprovalRulesModal = lazy(() => import('../components/ApprovalRules/ApprovalRulesModal'));

const SKELETON_CARDS = 6;

export default function Areas() {
  const { t } = useI18n();
  const view = useAreasView();
  const {
    isAdmin,
    areas,
    proposals,
    isLoading,
    error,
    reload,
    handleApprove,
    handleReject,
    selectMode,
    selectedIds,
    stopSelecting,
    search,
    setSearch,
    filter,
    setFilter,
    sort,
    setSort,
    resetListQuery,
    byAreaId,
    overviewLoading,
    overviewFailed,
    gradeMax,
    resetOrder,
    isCustomOrder,
    visible,
    personal,
    official,
    summary,
    isNarrowed,
    noResults,
    canReorder,
    isBulkOpen,
    setIsBulkOpen,
  } = view;

  return (
    <PageLayout>
      <PageHeader
        title={t('ui.areas')}
        description={t('ui.officialAreasAreSharedBy')}
        action={<AreaHeaderActions view={view} />}
      />

      {isLoading ? (
        <>
          {/* Reserva o espaco da faixa de numeros e da barra de pesquisa para a
              lista nao saltar quando os dados chegam. */}
          <AreaSummaryStripSkeleton />
          <div aria-hidden="true" className="mb-6">
            <Skeleton className="h-10 w-full sm:max-w-sm" />
          </div>
          <CardGridSkeleton cards={SKELETON_CARDS} />
        </>
      ) : error ? (
        <ErrorState message={error} onRetry={() => void reload()} />
      ) : (
        <div className="motion-page">
          {isAdmin && (
            <AreaProposalsPanel proposals={proposals} onApprove={handleApprove} onReject={handleReject} />
          )}

          {areas.length > 0 && (
            <>
              <AreaSummaryStrip summary={summary} overviewLoading={overviewLoading} />
              <AreaToolbar
                search={search}
                onSearchChange={setSearch}
                filter={filter}
                onFilterChange={setFilter}
                sort={sort}
                onSortChange={setSort}
                shownCount={visible.length}
                totalCount={areas.length}
                isNarrowed={isNarrowed}
                onResetFilters={resetListQuery}
                showResetOrder={isCustomOrder && sort === 'manual'}
                onResetOrder={resetOrder}
              />
              {overviewFailed && <p className="-mt-3 mb-6 text-xs text-neutral-500">{t('areas.overview.failed')}</p>}
              {canReorder && visible.length > 1 && (
                <p className="-mt-3 mb-6 hidden text-xs text-neutral-500 sm:block">{t('areaOrder.hint')}</p>
              )}
            </>
          )}

          {noResults ? (
            <EmptyState
              message={t('areas.empty.noResults')}
              action={
                <Button variant="secondary" size="sm" onClick={resetListQuery} className={HEADER_BUTTON_CLASS}>
                  {t('areas.empty.reset')}
                </Button>
              }
            />
          ) : (
            <AreaOverviewContext.Provider
              value={{ byAreaId, isLoading: overviewLoading, failed: overviewFailed, gradeMax }}
            >
              {(!isNarrowed || personal.length > 0) && <PersonalAreasSection view={view} />}
              {(!isNarrowed || official.length > 0) && <OfficialAreasSection view={view} />}
            </AreaOverviewContext.Provider>
          )}

          {selectMode && <AreaSelectionBar view={view} />}
        </div>
      )}

      <AreaModals view={view} />

      {isBulkOpen && (
        <Suspense fallback={null}>
          <ApprovalRulesModal
            isOpen
            onClose={() => setIsBulkOpen(false)}
            scope="area"
            targetId=""
            bulkAreaIds={selectedIds}
            onBulkApplied={stopSelecting}
          />
        </Suspense>
      )}
    </PageLayout>
  );
}
