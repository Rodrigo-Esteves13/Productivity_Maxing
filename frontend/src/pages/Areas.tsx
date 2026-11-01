import { lazy, Suspense, useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import Modal from '../components/UI/Modal';
import Button from '../components/UI/Button';
import ErrorState from '../components/UI/ErrorState';
import EmptyState from '../components/UI/EmptyState';
import CardGridSkeleton from '../components/UI/CardGridSkeleton';
import ModalHeaderActions from '../components/UI/ModalHeaderActions';
import { ChevronDownIcon, PlusIcon } from '../components/UI/Icons';
import AreaGrid from '../components/Areas/AreaGrid';
import AreaForm from '../components/Areas/AreaForm';
import AreaDetailView from '../components/Areas/AreaDetailView';
import AreaProposalsPanel from '../components/Areas/AreaProposalsPanel';
import AreaToolbar from '../components/Areas/AreaToolbar';
import AreaSummaryStrip, { AreaSummaryStripSkeleton } from '../components/Areas/AreaSummaryStrip';
import Skeleton from '../components/UI/Skeleton';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useAreasPage } from '../hooks/useAreasPage';
import { useAreaOverview } from '../hooks/useAreaOverview';
import { useI18n } from '../i18n/useI18n';
import { useAreaOrder } from '../hooks/useAreaOrder';
import { useAcademic } from '../context/useAcademic';
import { filterAreas, hasActiveListQuery, sortAreaList, summarizeAreas } from '../lib/areaList';
import { scaleMax } from '../lib/gradeScale';
import type { Area } from '../types/models';

const ApprovalRulesModal = lazy(() => import('../components/ApprovalRules/ApprovalRulesModal'));

// Espelho do limite do backend para aplicar regras em massa.
const BULK_AREAS_MAX = 500;
const SKELETON_CARDS = 6;

// Botoes de texto pequenos (selecionar, ligar todas...) com alvo de 40px.
const GHOST_BUTTON_CLASS =
  'inline-flex min-h-10 items-center rounded px-1.5 text-xs font-medium text-neutral-400 transition-colors duration-[var(--duration-quick)] hover:text-white disabled:text-neutral-600 disabled:hover:text-neutral-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400';

const HEADER_BUTTON_CLASS = 'inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap';

function SectionCount({ count }: { count: number }) {
  const { t } = useI18n();
  return (
    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-neutral-800 px-1.5 text-[11px] font-medium tabular-nums text-neutral-300">
      <span aria-hidden="true">{count}</span>
      <span className="sr-only">{t('areas.section.count', { count })}</span>
    </span>
  );
}

// Cabecalho de seccao que fica preso por baixo da navbar (h-16) ao fazer scroll.
function SectionHeader({ heading, actions }: { heading: ReactNode; actions?: ReactNode }) {
  return (
    <div className="sticky top-16 z-10 -mx-1 mb-3 flex min-h-12 flex-wrap items-center justify-between gap-x-3 bg-neutral-950 px-1 py-1">
      {heading}
      {actions && <div className="flex flex-wrap items-center gap-x-2">{actions}</div>}
    </div>
  );
}

const SECTION_TITLE_CLASS = 'text-sm font-semibold uppercase tracking-wide text-neutral-400';

const SELECT_PARAM = 'select';
const SELECT_PARAM_ON = '1';

export default function Areas() {
  const { t, lang } = useI18n();
  useDocumentTitle('Areas');
  const {
    isAdmin,
    areas,
    proposals,
    taskTypes,
    isLoading,
    error,
    createMode,
    selectedArea,
    isEditing,
    isSubmitting,
    canManage,
    canEdit,
    openCreateModal,
    closeCreateModal,
    openDetailModal,
    startEditing,
    stopEditing,
    closeDetailModal,
    handleCreateArea,
    handleEditArea,
    handleDeleteArea,
    handleToggleHidden,
    handleToggleAllOfficial,
    handlePropose,
    handleWithdraw,
    handleApprove,
    handleReject,
    selectMode,
    selectedIds,
    startSelecting,
    stopSelecting,
    toggleSelected,
    selectIds,
    deselectIds,
    search,
    setSearch,
    filter,
    setFilter,
    sort,
    setSort,
    resetListQuery,
  } = useAreasPage();

  // Atalho da paleta de comandos (/areas?select=1): abre ja em modo de selecao.
  const [searchParams, setSearchParams] = useSearchParams();
  const wantsSelect = searchParams.get(SELECT_PARAM) === SELECT_PARAM_ON;
  useEffect(() => {
    if (!wantsSelect) return;
    startSelecting();
    setSearchParams({}, { replace: true });
    // startSelecting e estavel o suficiente: so interessa reagir ao parametro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsSelect]);

  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [isOfficialCollapsed, setIsOfficialCollapsed] = useState(false);
  const officialListId = useId();

  // Resumo opcional (tarefas, risco, docentes): as areas aparecem primeiro.
  const { byAreaId, isLoading: overviewLoading, failed: overviewFailed } = useAreaOverview();
  const { activeProgram, isViewingAllPrograms } = useAcademic();
  const gradeMax = activeProgram && !isViewingAllPrograms ? scaleMax(activeProgram.gradeScale) : null;

  const { sortAreas, moveArea, resetOrder, isCustom } = useAreaOrder();
  const ordered = useMemo(() => sortAreas(areas), [sortAreas, areas]);
  const query = { search, filter };
  const isNarrowed = hasActiveListQuery(query);
  const visible = useMemo(
    () => sortAreaList(filterAreas(ordered, { search, filter }, byAreaId), sort, byAreaId, lang),
    [ordered, search, filter, sort, byAreaId, lang],
  );
  const summary = useMemo(() => summarizeAreas(areas, byAreaId), [areas, byAreaId]);

  const official = visible.filter((a) => a.isOfficial);
  const personal = visible.filter((a) => !a.isOfficial);
  const officialTotal = areas.filter((a) => a.isOfficial).length;
  const personalTotal = areas.length - officialTotal;

  // Arrastar so na ordem manual e fora do modo de selecao. A troca usa a
  // ordem completa, por isso funciona mesmo com a lista filtrada.
  const canReorder = sort === 'manual' && !selectMode;
  const reorder = (draggedId: string, targetId: string) =>
    moveArea(ordered.map((a) => a.id), draggedId, targetId);

  const selectedSet = new Set(selectedIds);
  const handleToggleSelect = (area: Area) => toggleSelected(area.id);
  const isOfficialOpen = !isOfficialCollapsed || isNarrowed;
  const noResults = isNarrowed && areas.length > 0 && visible.length === 0;

  // "Select all" / "None" de uma seccao (ou de todas, na barra fixa).
  const selectionLinks = (ids: string[]) => (
    <div className="flex gap-1">
      <button
        type="button"
        onClick={() => selectIds(ids)}
        disabled={ids.every((id) => selectedSet.has(id))}
        className={GHOST_BUTTON_CLASS}
      >
        {t('areas.select.all')}
      </button>
      <button
        type="button"
        onClick={() => deselectIds(ids)}
        disabled={!ids.some((id) => selectedSet.has(id))}
        className={GHOST_BUTTON_CLASS}
      >
        {t('areas.select.none')}
      </button>
    </div>
  );

  const gridProps = {
    canManage,
    onSelect: openDetailModal,
    onEdit: startEditing,
    onDelete: handleDeleteArea,
    onReorder: canReorder ? reorder : undefined,
    selectMode,
    selectedIds: selectedSet,
    onToggleSelect: handleToggleSelect,
    overviewById: byAreaId,
    overviewLoading,
    overviewFailed,
    gradeMax,
  };

  const createFirstAction = (
    <Button size="sm" onClick={() => openCreateModal('personal')} className={HEADER_BUTTON_CLASS}>
      <PlusIcon aria-hidden="true" className="h-4 w-4" />
      {t('areas.empty.createFirst')}
    </Button>
  );

  return (
    <PageLayout>
      <PageHeader
        title={t('ui.areas')}
        description={t('ui.officialAreasAreSharedBy')}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {areas.length > 0 && (
              <Button
                variant="secondary"
                size="sm"
                aria-pressed={selectMode}
                onClick={selectMode ? stopSelecting : startSelecting}
                className={HEADER_BUTTON_CLASS}
              >
                {selectMode ? t('areas.select.cancel') : t('areas.select.start')}
              </Button>
            )}
            {isAdmin && (
              <Button variant="secondary" size="sm" onClick={() => openCreateModal('official')} className={HEADER_BUTTON_CLASS}>
                {t('ui.officialArea')}
              </Button>
            )}
            <Button size="sm" onClick={() => openCreateModal('personal')} className={HEADER_BUTTON_CLASS}>
              {t('ui.myArea')}
            </Button>
          </div>
        }
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
        <ErrorState message={error} />
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
                showResetOrder={isCustom && sort === 'manual'}
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
            <>
              {(!isNarrowed || personal.length > 0) && (
                <section className="mb-10" aria-label={t('ui.myAreas')}>
                  <SectionHeader
                    heading={
                      <h2 className={`flex items-center gap-2 ${SECTION_TITLE_CLASS}`}>
                        {t('ui.myAreas')}
                        <SectionCount count={personal.length} />
                      </h2>
                    }
                    actions={selectMode && personal.length > 0 ? selectionLinks(personal.map((a) => a.id)) : undefined}
                  />
                  {personalTotal === 0 ? (
                    <EmptyState message={t('ui.youHaveNoPersonalAreas')} action={createFirstAction} />
                  ) : (
                    <AreaGrid areas={personal} {...gridProps} />
                  )}
                </section>
              )}

              {(!isNarrowed || official.length > 0) && (
                <section aria-label={t('ui.officialAreas')}>
                  <SectionHeader
                    heading={
                      <h2 className={SECTION_TITLE_CLASS}>
                        <button
                          type="button"
                          aria-expanded={isOfficialOpen}
                          aria-controls={officialListId}
                          disabled={isNarrowed}
                          onClick={() => setIsOfficialCollapsed((prev) => !prev)}
                          className="-ml-1.5 inline-flex min-h-10 items-center gap-2 rounded px-1.5 uppercase tracking-wide transition-colors duration-[var(--duration-quick)] hover:text-white disabled:hover:text-neutral-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400"
                        >
                          <ChevronDownIcon
                            aria-hidden="true"
                            className={`h-4 w-4 transition-transform duration-[var(--duration-fast)] ease-smooth-out ${
                              isOfficialOpen ? '' : '-rotate-90'
                            }`}
                          />
                          {t('ui.officialAreas')}
                          <SectionCount count={official.length} />
                        </button>
                      </h2>
                    }
                    actions={
                      officialTotal > 0 && isOfficialOpen ? (
                        <>
                          {selectMode && official.length > 0 && selectionLinks(official.map((a) => a.id))}
                          <button type="button" onClick={() => void handleToggleAllOfficial(false)} className={GHOST_BUTTON_CLASS}>
                            {t('ui.turnAllOn')}
                          </button>
                          <button type="button" onClick={() => void handleToggleAllOfficial(true)} className={GHOST_BUTTON_CLASS}>
                            {t('ui.turnAllOff')}
                          </button>
                        </>
                      ) : undefined
                    }
                  />
                  {/* Recolhe com grid-rows 1fr/0fr; fechada fica invisivel e inerte
                      (sem foco nem leitores de ecra) quando a animacao acaba. */}
                  <div
                    id={officialListId}
                    inert={!isOfficialOpen}
                    className={`grid transition-[grid-template-rows,visibility] duration-[var(--duration-fast)] ease-smooth-out ${
                      isOfficialOpen ? 'visible grid-rows-[1fr]' : 'invisible grid-rows-[0fr]'
                    }`}
                  >
                    {/* -m-1 p-1: o overflow-hidden nao corta aneis de foco nem de arrastar. */}
                    <div className="-m-1 min-h-0 overflow-hidden p-1">
                      <p className="mb-3 text-xs text-neutral-500">{t('ui.turnedOffAreasDisappearFrom')}</p>
                      {officialTotal === 0 ? (
                        <EmptyState message={t('ui.noOfficialAreasYet')} />
                      ) : (
                        <AreaGrid
                          areas={official}
                          onToggleHidden={(a) => void handleToggleHidden(a)}
                          {...gridProps}
                        />
                      )}
                    </div>
                  </div>
                </section>
              )}
            </>
          )}

          {selectMode && (
            <div
              role="region"
              aria-label={t('areas.select.start')}
              // Preso ao fundo acima da area segura (iPhone); dentro do fluxo,
              // por isso no fim da pagina nunca tapa o ultimo cartao.
              className="motion-toast sticky bottom-[calc(1rem+env(safe-area-inset-bottom))] z-20 mt-6 flex flex-col gap-3 rounded-xl border border-neutral-700 bg-neutral-900/95 px-4 py-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex flex-wrap items-center justify-between gap-x-4 sm:justify-start">
                <span role="status" className="text-sm font-medium tabular-nums text-white">
                  {t('areas.select.count', { count: selectedIds.length })}
                </span>
                {selectionLinks(visible.map((a) => a.id))}
              </div>
              <div className="flex flex-col gap-1 sm:items-end">
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={stopSelecting} className={`${HEADER_BUTTON_CLASS} flex-1 justify-center sm:flex-none`}>
                    {t('areas.select.cancel')}
                  </Button>
                  <Button
                    size="sm"
                    disabled={selectedIds.length === 0 || selectedIds.length > BULK_AREAS_MAX}
                    onClick={() => setIsBulkOpen(true)}
                    className={`${HEADER_BUTTON_CLASS} flex-1 justify-center sm:flex-none`}
                  >
                    {t('areas.select.setRules')}
                  </Button>
                </div>
                {selectedIds.length > BULK_AREAS_MAX && (
                  <p role="alert" className="text-xs text-neutral-400">
                    {t('areas.select.limit', { max: BULK_AREAS_MAX })}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <Modal
        isOpen={createMode !== null}
        onClose={closeCreateModal}
        title={createMode === 'official' ? t('ui.createOfficialArea') : t('ui.createMyArea')}
      >
        <AreaForm
          idPrefix="create-area"
          taskTypes={taskTypes}
          onSubmit={handleCreateArea}
          onCancel={closeCreateModal}
          isSubmitting={isSubmitting}
          submitLabel={t('ui.createArea')}
          submittingLabel={t('common.creating')}
        />
      </Modal>

      <Modal
        isOpen={selectedArea !== null}
        onClose={closeDetailModal}
        title={isEditing ? t('ui.editArea') : t('ui.areaDetails')}
        action={
          selectedArea &&
          canManage(selectedArea) && (
            <ModalHeaderActions
              isEditing={isEditing}
              onToggleEdit={() => {
                if (isEditing) stopEditing();
                else if (canEdit(selectedArea)) startEditing(selectedArea);
              }}
              onDelete={() => handleDeleteArea(selectedArea.id)}
              deleteTitle={t('ui.deleteArea')}
              editTitle={t('ui.editArea2')}
            />
          )
        }
      >
        {selectedArea &&
          (isEditing ? (
            <AreaForm
              idPrefix="edit-area"
              initialValues={{
                name: selectedArea.name,
                colorHex: selectedArea.colorHex,
                defaultTaskType: selectedArea.defaultTaskType,
                credits: selectedArea.credits,
              }}
              taskTypes={taskTypes}
              onSubmit={handleEditArea}
              onCancel={stopEditing}
              isSubmitting={isSubmitting}
              submitLabel={t('ui.saveChanges')}
              submittingLabel={t('common.saving')}
            />
          ) : (
            <AreaDetailView
              area={selectedArea}
              taskTypes={taskTypes}
              onPropose={handlePropose}
              onWithdraw={handleWithdraw}
            />
          ))}
      </Modal>

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
