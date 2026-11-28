import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAcademic } from '../context/useAcademic';
import { useI18n } from '../i18n/useI18n';
import { filterAreas, hasActiveListQuery, sortAreaList, summarizeAreas } from '../lib/areaList';
import { splitAreaSections } from '../lib/areaSections';
import { scaleMax } from '../lib/gradeScale';
import useDocumentTitle from './useDocumentTitle';
import { useAreaOrder } from './useAreaOrder';
import { useAreaOverview } from './useAreaOverview';
import { useAreasPage } from './useAreasPage';

const SELECT_PARAM = 'select';
const SELECT_PARAM_ON = '1';

// Estado da pagina Areas: dados e acoes (useAreasPage) mais a lista que se ve.
export function useAreasView() {
  const { t, lang } = useI18n();
  useDocumentTitle(t('nav.areas'));
  const page = useAreasPage();
  const { areas, search, filter, sort, selectMode, selectedIds, startSelecting } = page;

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

  // Resumo opcional (tarefas, risco, docentes): as areas aparecem primeiro.
  const { byAreaId, isLoading: overviewLoading, failed: overviewFailed } = useAreaOverview();
  const { activeProgram, isViewingAllPrograms } = useAcademic();
  const gradeMax = activeProgram && !isViewingAllPrograms ? scaleMax(activeProgram.gradeScale) : null;

  const { sortAreas, moveArea, resetOrder, isCustom } = useAreaOrder();
  const ordered = useMemo(() => sortAreas(areas), [sortAreas, areas]);
  const isNarrowed = hasActiveListQuery({ search, filter });
  const visible = useMemo(
    () => sortAreaList(filterAreas(ordered, { search, filter }, byAreaId), sort, byAreaId, lang),
    [ordered, search, filter, sort, byAreaId, lang],
  );
  const summary = useMemo(() => summarizeAreas(areas, byAreaId), [areas, byAreaId]);

  // Arrastar so na ordem manual e fora do modo de selecao. A troca usa a
  // ordem completa, por isso funciona mesmo com a lista filtrada.
  const canReorder = sort === 'manual' && !selectMode;
  const reorder = (draggedId: string, targetId: string) =>
    moveArea(ordered.map((a) => a.id), draggedId, targetId);

  return {
    ...page,
    ...splitAreaSections(areas, visible),
    byAreaId,
    overviewLoading,
    overviewFailed,
    gradeMax,
    resetOrder,
    isCustomOrder: isCustom,
    visible,
    summary,
    isNarrowed,
    noResults: isNarrowed && areas.length > 0 && visible.length === 0,
    canReorder,
    reorder,
    selectedSet: new Set(selectedIds),
    isBulkOpen,
    setIsBulkOpen,
    isOfficialOpen: !isOfficialCollapsed || isNarrowed,
    toggleOfficial: () => setIsOfficialCollapsed((prev) => !prev),
  };
}

export type AreasViewState = ReturnType<typeof useAreasView>;
