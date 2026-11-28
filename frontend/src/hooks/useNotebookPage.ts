import { useEffect, useMemo, useRef, useState } from 'react';
import { detectClassNow, upsertScheduleLink } from '../api/notebookService';
import { useAcademic } from '../context/useAcademic';
import { useI18n } from '../i18n/useI18n';
import { newEntryDateIso } from '../components/Notebook/entry/notebookEntryConfig';
import {
  adjacentEntries,
  buildFallbackTitle,
  fallbackArea,
  nextClassNumber as suggestClassNumber,
  shareBadges,
} from '../lib/notebookPage';
import useDocumentTitle from './useDocumentTitle';
import { useMyShares } from './useMyShares';
import { useNotebookAreas } from './useNotebookAreas';
import { useNotebookEntries } from './useNotebookEntries';
import { useNotebookEntryLink } from './useNotebookEntryLink';
import { useNotebookExport } from './useNotebookExport';
import { useNotebookSearch } from './useNotebookSearch';
import type { Area, NotebookEntry, NotebookEntrySummary, NotebookSearchResult } from '../types/models';

const LAST_AREA_KEY = 'pmaxing-notebook-area';

function readLastAreaId(): string | null {
  try {
    return window.localStorage.getItem(LAST_AREA_KEY);
  } catch {
    return null;
  }
}

function writeLastAreaId(id: string): void {
  try {
    window.localStorage.setItem(LAST_AREA_KEY, id);
  } catch {
    /* sem storage (modo privado): so perde o atalho */
  }
}

// Estado e acoes da pagina do caderno.
export function useNotebookPage() {
  const { t, lang } = useI18n();
  useDocumentTitle(t('notebook.title'));
  const { activePeriod, isViewingAllPeriods, isViewingAllPrograms } = useAcademic();
  // Mesma regra que useTasksPage.ts usa para as tasks: 'all' quando o
  // utilizador está deliberadamente a ver tudo, senão o período ativo.
  const periodParam = isViewingAllPeriods || isViewingAllPrograms ? 'all' : activePeriod?.id;
  const groupByPeriod = Boolean(periodParam) && periodParam !== 'all';

  const { areas, isLoading: areasLoading, error: areasError, reload: reloadAreas } = useNotebookAreas(periodParam);
  // ?area=<id> abre logo o caderno dessa cadeira (atalho do Focus).
  // Sem ?area, abre a ultima cadeira que o utilizador estava a ver.
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(
    () => new URLSearchParams(window.location.search).get('area') ?? readLastAreaId(),
  );
  useEffect(() => {
    if (selectedAreaId) writeLastAreaId(selectedAreaId);
  }, [selectedAreaId]);
  const notebook = useNotebookEntries(selectedAreaId);
  const { entries, selectedId, selectEntry, createEntry } = notebook;
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  // Uma entrada mesmo criada agora (vazia, nada a estragar) abre logo em
  // edição - só entradas já existentes é que abrem em leitura por
  // omissão. Limpo assim que o utilizador escolhe outra entrada
  // manualmente, para não voltar a abrir em edição se regressar a esta
  // mais tarde na mesma sessão.
  const [justCreatedEntryId, setJustCreatedEntryId] = useState<string | null>(null);
  // Remontar o editor da entrada aberta (conflito resolvido com a versao dos
  // outros, copia por gravar reposta), sem sair da edicao.
  const [reopened, setReopened] = useState<{ id: string; seq: number } | null>(null);

  const nextClassNumber = useMemo(() => suggestClassNumber(entries), [entries]);

  const selectedArea = areas.find((a) => a.id === selectedAreaId) ?? null;

  // A ultima cadeira guardada pode ja nao existir neste periodo: em vez de
  // um ecra vazio a pedir "escolhe uma cadeira", abre a primeira (as do
  // periodo primeiro).
  useEffect(() => {
    if (areasLoading || selectedArea) return;
    const fallback = fallbackArea(areas);
    if (fallback) setSelectedAreaId(fallback.id);
  }, [areasLoading, areas, selectedArea]);

  const myShares = useMyShares();
  const shareByEntry = useMemo(() => shareBadges(myShares.items), [myShares.items]);
  const sharedInArea = selectedArea
    ? myShares.items.filter((share) => share.areaId === selectedArea.id).length
    : 0;

  const adjacent = adjacentEntries(entries, selectedId);

  // Telemovel: a lista fica por cima do editor, por isso ao escolher uma
  // nota salta-se para ela (no ecra largo estao lado a lado).
  const editorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!selectedId || window.matchMedia('(min-width: 768px)').matches) return;
    // Sem animacao para quem pediu menos movimento (sistema ou Perfil).
    const reduceMotion =
      document.documentElement.getAttribute('data-motion') === 'reduced' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    editorRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }, [selectedId]);

  const exporter = useNotebookExport(selectedArea);

  const handleNewEntry = async () => {
    if (!selectedAreaId) return;
    setIsCreating(true);
    setCreateError('');
    try {
      // Só verifica "há aula agora" no momento de criar, não em segundo
      // plano - ver comentário em NotebookService.detectClassNow no backend.
      const detection = await detectClassNow(selectedAreaId).catch(() => ({
        occurrence: null,
        matchedByName: false,
      }));
      const isClassNow = Boolean(detection.occurrence);

      // Aula achada pelo nome: liga a cadeira ao horario para a proxima vez
      // ser automatica. Falha silenciosa (a lição cria-se na mesma).
      if (detection.occurrence && detection.matchedByName) {
        void upsertScheduleLink(selectedAreaId, detection.occurrence.subject).catch(() => undefined);
      }

      await createEntry({
        areaId: selectedAreaId,
        classOccurrenceId: detection.occurrence?.id,
        entryType: isClassNow ? 'CLASS' : 'NOTE',
        classNumber: isClassNow ? nextClassNumber : undefined,
        title: buildFallbackTitle(lang),
        date: newEntryDateIso(),
      }).then((created) => setJustCreatedEntryId(created.id));
    } catch {
      setCreateError(t('notebook.createError'));
    } finally {
      setIsCreating(false);
    }
  };

  const search = useNotebookSearch();

  // Escolha manual na lista: deixa de abrir a recem-criada em edicao.
  const openFromList = (entry: NotebookEntrySummary) => {
    selectEntry(entry);
    setJustCreatedEntryId(null);
  };

  const selectArea = (area: Area) => {
    setSelectedAreaId(area.id);
    selectEntry(null);
  };

  // Nota vinda de fora da lista (pesquisa ou link): muda tambem de cadeira.
  const openElsewhere = (areaId: string, entry: NotebookEntry | NotebookEntrySummary) => {
    search.setSearchQuery('');
    setSelectedAreaId(areaId);
    selectEntry(entry);
    setJustCreatedEntryId(null);
  };

  const handleSelectSearchResult = (result: NotebookSearchResult) => openElsewhere(result.area.id, result);

  useNotebookEntryLink((entry) => openElsewhere(entry.areaId, entry));

  const reopenEntry = (id: string) =>
    setReopened((prev) => ({ id, seq: prev?.id === id ? prev.seq + 1 : 1 }));

  return {
    ...notebook,
    ...exporter,
    ...adjacent,
    search,
    areas,
    areasLoading,
    areasError,
    reloadAreas,
    groupByPeriod,
    selectedAreaId,
    selectedArea,
    selectArea,
    isCreating,
    createError,
    justCreatedEntryId,
    reopened,
    reopenEntry,
    nextClassNumber,
    shareByEntry,
    sharedInArea,
    editorRef,
    handleNewEntry,
    openFromList,
    handleSelectSearchResult,
  };
}

export type NotebookPageState = ReturnType<typeof useNotebookPage>;
