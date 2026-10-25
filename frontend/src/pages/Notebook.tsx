import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { socialTabPath } from '../lib/appLinks';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import Button from '../components/UI/Button';
import EmptyState from '../components/UI/EmptyState';
import { useI18n } from '../i18n/useI18n';
import LinesSkeleton from '../components/UI/LinesSkeleton';
import ErrorState from '../components/UI/ErrorState';
import NotebookSubjectPicker from '../components/Notebook/NotebookSubjectPicker';
import NotebookEntryList, { type EntryShareBadge } from '../components/Notebook/NotebookEntryList';
import NotebookEntryEditor from '../components/Notebook/NotebookEntryEditor';
import NotebookScheduleLink from '../components/Notebook/NotebookScheduleLink';
import NotebookSearchResults from '../components/Notebook/NotebookSearchResults';
import NotebookSharedPanel from '../components/Notebook/NotebookSharedPanel';
import NotebookAreaOverview from '../components/Notebook/NotebookAreaOverview';
import { useAcademic } from '../context/useAcademic';
import { useNotebookAreas } from '../hooks/useNotebookAreas';
import { useNotebookEntries } from '../hooks/useNotebookEntries';
import {
  detectClassNow,
  upsertScheduleLink,
  uploadNotebookPhoto,
  deleteNotebookPhoto,
  uploadNotebookAttachment,
  deleteNotebookAttachment,
  searchNotebook,
  getNotebookEntry,
  getNotebookEntriesFull,
} from '../api/notebookService';
import { courseToMarkdown, entryTitle, entryToMarkdown, markdownFileName } from '../lib/notebookMarkdown';
import { downloadTextFile } from '../utils/downloadTextFile';
import { rememberSharePanelOpen } from '../hooks/useEntryShare';
import { useMyShares } from '../hooks/useMyShares';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon, PlusIcon, SearchIcon, XIcon } from '../components/UI/Icons';
import { newEntryDateIso } from '../components/Notebook/entry/notebookEntryConfig';
import { clearPendingNotebookEntry } from '../lib/pendingNotebookEntry';
import type { NotebookEntry, NotebookSearchResult } from '../types/models';

const MARKDOWN_MIME = 'text/markdown;charset=utf-8';

// Título nunca pode ficar vazio (o backend exige @IsNotEmpty) - sem aula
// detetada, usa a data por extenso em vez de deixar em branco.
function buildFallbackTitle(locale: string): string {
  const label = new Date().toLocaleDateString(locale, {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

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

// Debounce simples da pesquisa - evita um pedido por tecla premida.
const SEARCH_DEBOUNCE_MS = 300;

export default function Notebook() {
  const { t, lang } = useI18n();
  useDocumentTitle(t('notebook.title'));
  const { activePeriod, isViewingAllPeriods, isViewingAllPrograms } = useAcademic();
  // Mesma regra que useTasksPage.ts usa para as tasks: 'all' quando o
  // utilizador está deliberadamente a ver tudo, senão o período ativo.
  const periodParam = isViewingAllPeriods || isViewingAllPrograms ? 'all' : activePeriod?.id;
  const groupByPeriod = Boolean(periodParam) && periodParam !== 'all';

  const { areas, isLoading: areasLoading, error: areasError } = useNotebookAreas(periodParam);
  // ?area=<id> abre logo o caderno dessa cadeira (atalho do Focus).
  // Sem ?area, abre a ultima cadeira que o utilizador estava a ver.
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(
    () => new URLSearchParams(window.location.search).get('area') ?? readLastAreaId(),
  );
  useEffect(() => {
    if (selectedAreaId) writeLastAreaId(selectedAreaId);
  }, [selectedAreaId]);
  const {
    entries,
    isLoading: entriesLoading,
    selectedId,
    selectedEntry,
    isLoadingEntry,
    entryError,
    selectEntry,
    prefetchEntry,
    retryEntry,
    replaceEntry,
    patchEntry,
    reloadEntry,
    createEntry,
    updateEntry,
    removeEntry,
  } = useNotebookEntries(selectedAreaId);
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

  // Maior classNumber já usado nesta Area (entre entradas CLASS) + 1 - só
  // uma sugestão, nunca bloqueia o utilizador de repetir ou saltar um
  // número (ver pedido original: uma aula física pode dar para duas
  // cadeiras e ele quer duas entradas separadas, cada uma como se fosse
  // "mudar de página").
  const nextClassNumber = useMemo(() => {
    const usedNumbers = entries
      .filter((e) => e.entryType === 'CLASS' && e.classNumber != null)
      .map((e) => e.classNumber as number);
    return usedNumbers.length > 0 ? Math.max(...usedNumbers) + 1 : 1;
  }, [entries]);

  const selectedArea = areas.find((a) => a.id === selectedAreaId) ?? null;

  // A ultima cadeira guardada pode ja nao existir neste periodo: em vez de
  // um ecra vazio a pedir "escolhe uma cadeira", abre a primeira (as do
  // periodo primeiro).
  useEffect(() => {
    if (areasLoading || areas.length === 0 || selectedArea) return;
    const fallback = areas.find((a) => a.usedInPeriod) ?? areas[0];
    setSelectedAreaId(fallback.id);
  }, [areasLoading, areas, selectedArea]);

  // Estado de partilha de cada nota (icone e pendentes na lista).
  const myShares = useMyShares();
  const shareByEntry = useMemo(
    () =>
      new Map<string, EntryShareBadge>(
        myShares.items.map((share) => [
          share.entryId,
          { waiting: share.pendingRequests + share.pendingProposals },
        ]),
      ),
    [myShares.items],
  );
  const sharedInArea = selectedArea
    ? myShares.items.filter((share) => share.areaId === selectedArea.id).length
    : 0;

  // Anterior/seguinte na ordem da lista (mais recente primeiro): "anterior"
  // e a entrada mais antiga a seguir, "seguinte" a mais recente.
  const selectedIndex = selectedId ? entries.findIndex((e) => e.id === selectedId) : -1;
  const olderEntry = selectedIndex >= 0 ? (entries[selectedIndex + 1] ?? null) : null;
  const newerEntry = selectedIndex > 0 ? entries[selectedIndex - 1] : null;

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

  const [isExportingCourse, setIsExportingCourse] = useState(false);
  const [exportError, setExportError] = useState('');

  // A entrada aberta ja esta completa em memoria: descarrega logo.
  const exportEntry = (entry: NotebookEntry) => {
    if (!selectedArea) return;
    downloadTextFile(
      entryToMarkdown(entry, selectedArea.name, t),
      markdownFileName(selectedArea.name, entry.date.slice(0, 10), entryTitle(entry, t)),
      MARKDOWN_MIME,
    );
  };

  // A lista so tem resumos: a cadeira inteira pede o conteudo completo.
  const exportCourse = async () => {
    if (!selectedArea || isExportingCourse) return;
    setIsExportingCourse(true);
    setExportError('');
    try {
      const fullEntries = await getNotebookEntriesFull(selectedArea.id);
      downloadTextFile(courseToMarkdown(selectedArea.name, fullEntries, t), markdownFileName(selectedArea.name), MARKDOWN_MIME);
    } catch {
      setExportError(t('notebook.export.error'));
    } finally {
      setIsExportingCourse(false);
    }
  };

  const handleNewEntry = async () => {
    if (!selectedAreaId) return;
    setIsCreating(true);
    setCreateError('');
    try {
      // Só verifica "há aula agora" no momento de criar, não em segundo
      // plano - ver comentário em NotebookService.detectClassNow no backend.
      const detection = await detectClassNow(selectedAreaId).catch(() => ({
        occurrence: null,
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

  // --- Pesquisa global --------------------------------------------------
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // "/" foca a pesquisa (como no GitHub/YouTube), se nao estiveres a escrever.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      event.preventDefault();
      searchInputRef.current?.focus();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
  const [searchResults, setSearchResults] = useState<NotebookSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    setIsSearching(true);
    const timeout = setTimeout(() => {
      searchNotebook(trimmed)
        .then((results) => {
          if (!cancelled) setSearchResults(results);
        })
        .catch(() => {
          if (!cancelled) setSearchResults([]);
        })
        .finally(() => {
          if (!cancelled) setIsSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [searchQuery]);

  const handleSelectSearchResult = (result: NotebookSearchResult) => {
    setSearchQuery('');
    setSelectedAreaId(result.area.id);
    selectEntry(result);
    setJustCreatedEntryId(null);
  };

  // Sobra de versoes antigas: o Command Palette deixava a entrada em
  // sessionStorage. Agora usa ?entry=<id>; limpa um snapshot que tenha
  // ficado para nunca abrir uma copia velha.
  useEffect(() => {
    clearPendingNotebookEntry();
  }, []);

  // ?entry=<id>(&share=1): vindo do Social, de uma nota partilhada ou de um
  // aviso push. Abre a nota (e o painel de partilha) e limpa o URL, para um
  // F5 depois de mudar de nota nao voltar a esta.
  const [searchParams, setSearchParams] = useSearchParams();
  const linkedEntryId = searchParams.get('entry');
  const linkedShare = searchParams.get('share') === '1';
  useEffect(() => {
    if (!linkedEntryId) return undefined;
    if (linkedShare) rememberSharePanelOpen();
    let cancelled = false;
    getNotebookEntry(linkedEntryId)
      .then((entry) => {
        if (cancelled) return;
        setSearchQuery('');
        setSelectedAreaId(entry.areaId);
        selectEntry(entry);
        setJustCreatedEntryId(null);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setSearchParams({}, { replace: true });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- so reage ao link
  }, [linkedEntryId, linkedShare]);

  const isSearchActive = searchQuery.trim().length > 0;

  return (
    <PageLayout>
      <PageHeader title={t('notebook.title')} description={t('notebook.description')} />

      <NotebookSharedPanel />

      <div className="relative mb-6">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
        <input
          ref={searchInputRef}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('notebook.search.placeholder')}
          aria-label={t('notebook.search.placeholder')}
          className="w-full rounded-lg border border-neutral-800 bg-neutral-900 py-2.5 pl-10 pr-9 text-sm text-neutral-100 placeholder-neutral-600 focus:border-violet-500 focus:outline-none"
        />
        {!isSearchActive && (
          <kbd
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-neutral-700 px-1.5 py-0.5 text-[10px] text-neutral-500 sm:block"
          >
            /
          </kbd>
        )}
        {isSearchActive && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
            aria-label={t('notebook.search.clear')}
          >
            <XIcon className="h-4 w-4" />
          </button>
        )}
      </div>

      {isSearchActive ? (
        <NotebookSearchResults
          results={searchResults}
          isLoading={isSearching}
          query={searchQuery}
          onSelect={handleSelectSearchResult}
        />
      ) : (
        <>
          {areasLoading ? (
            <LinesSkeleton lines={5} />
          ) : areasError ? (
            <ErrorState message={areasError} />
          ) : areas.length === 0 ? (
            <p className="text-sm text-neutral-500">{t('notebook.subjects.none')}</p>
          ) : (
            <NotebookSubjectPicker
              areas={areas}
              selectedAreaId={selectedAreaId}
              groupByPeriod={groupByPeriod}
              onSelect={(area) => {
                setSelectedAreaId(area.id);
                selectEntry(null);
              }}
            />
          )}

          {!selectedArea ? (
            <div className="mt-6">
              <EmptyState message={t('notebook.pick')} />
            </div>
          ) : (
            <div className="mt-6 space-y-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <h2 className="flex items-center gap-2.5 font-serif text-2xl font-semibold text-white">
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: selectedArea.colorHex }} />
                    <span className="truncate">{selectedArea.name}</span>
                  </h2>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {!entriesLoading && (
                      <span className="text-xs text-neutral-500">
                        {t(entries.length === 1 ? 'notebook.entries.countOne' : 'notebook.entries.count', {
                          count: entries.length,
                        })}
                      </span>
                    )}
                    {sharedInArea > 0 && (
                      <Link to={socialTabPath('mine')} className="text-xs text-violet-400 hover:underline">
                        {t(sharedInArea === 1 ? 'notebook.entries.sharedOne' : 'notebook.entries.shared', {
                          count: sharedInArea,
                        })}
                      </Link>
                    )}
                    <NotebookScheduleLink areaId={selectedArea.id} />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {createError && <span className="text-xs text-red-400">{createError}</span>}
                  {exportError && (
                    <span role="alert" className="text-xs text-red-400">
                      {exportError}
                    </span>
                  )}
                  {entries.length > 0 && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void exportCourse()}
                      disabled={isExportingCourse}
                      title={t('notebook.export.courseHint')}
                      className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium disabled:opacity-50"
                    >
                      <DownloadIcon className="h-4 w-4" />
                      {isExportingCourse ? t('notebook.export.exporting') : t('notebook.export.course')}
                    </Button>
                  )}
                  <Button
                    type="button"
                    onClick={handleNewEntry}
                    disabled={isCreating}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium disabled:opacity-50"
                  >
                    <PlusIcon className="h-4 w-4" />
                    {isCreating ? t('notebook.checkingSchedule') : t('notebook.newEntry')}
                  </Button>
                </div>
              </div>

              {!entriesLoading && entries.length === 0 ? (
                // Caderno vazio: um so convite a comecar, sem lista vazia ao lado.
                <NotebookAreaOverview
                  entries={entries}
                  isCreating={isCreating}
                  onSelect={selectEntry}
                  onNewEntry={() => void handleNewEntry()}
                />
              ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-[16rem_minmax(0,1fr)] lg:grid-cols-[18rem_minmax(0,1fr)]">
                <div className="md:sticky md:top-20 md:max-h-[calc(100vh-6rem)] md:self-start md:overflow-y-auto md:pr-1">
                  {entriesLoading ? (
                    <LinesSkeleton lines={4} />
                  ) : (
                    <NotebookEntryList
                      entries={entries}
                      shareByEntry={shareByEntry}
                      selectedId={selectedId}
                      onPrefetch={prefetchEntry}
                      onSelect={(entry) => {
                        selectEntry(entry);
                        setJustCreatedEntryId(null);
                      }}
                    />
                  )}
                </div>

                <div ref={editorRef} className="min-w-0 scroll-mt-20">
                  {selectedId && (
                    <nav
                      aria-label={t('notebook.nav.label')}
                      className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs"
                    >
                      <button
                        type="button"
                        onClick={() => selectEntry(null)}
                        className="rounded-md px-2 py-1 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white"
                      >
                        {t('notebook.nav.overview')}
                      </button>
                      <div className="flex items-center gap-1">
                        <span className="px-1 tabular-nums text-neutral-500">
                          {t('notebook.nav.position', { index: selectedIndex + 1, total: entries.length })}
                        </span>
                        <button
                          type="button"
                          disabled={!olderEntry}
                          onClick={() => olderEntry && selectEntry(olderEntry)}
                          onPointerEnter={() => olderEntry && prefetchEntry(olderEntry.id)}
                          title={olderEntry?.title}
                          className="flex items-center gap-0.5 rounded-md px-2 py-1 text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
                        >
                          <ChevronLeftIcon className="h-3.5 w-3.5" />
                          {t('notebook.nav.older')}
                        </button>
                        <button
                          type="button"
                          disabled={!newerEntry}
                          onClick={() => newerEntry && selectEntry(newerEntry)}
                          onPointerEnter={() => newerEntry && prefetchEntry(newerEntry.id)}
                          title={newerEntry?.title}
                          className="flex items-center gap-0.5 rounded-md px-2 py-1 text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
                        >
                          {t('notebook.nav.newer')}
                          <ChevronRightIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </nav>
                  )}
                  {selectedEntry ? (
                    <NotebookEntryEditor
                      key={`${selectedEntry.id}:${reopened?.id === selectedEntry.id ? reopened.seq : 0}`}
                      entry={selectedEntry}
                      suggestedClassNumber={nextClassNumber}
                      startInEditMode={selectedEntry.id === justCreatedEntryId || reopened?.id === selectedEntry.id}
                      onAdoptServerVersion={replaceEntry}
                      onReopen={() =>
                        setReopened((prev) => ({
                          id: selectedEntry.id,
                          seq: prev?.id === selectedEntry.id ? prev.seq + 1 : 1,
                        }))
                      }
                      onProposalApplied={() => void reloadEntry(selectedEntry.id)}
                      onSave={({ title, entryType, classNumber, textContent, drawingStrokes, tables, canvasShapes, canvasLinks, canvasTexts, usefulLinks, canvasHeight, date, privateFromFriends }) =>
                        updateEntry(selectedEntry.id, {
                          title,
                          entryType,
                          classNumber,
                          textContent,
                          drawingStrokes,
                          tables,
                          canvasShapes,
                          canvasLinks,
                          canvasTexts,
                          usefulLinks,
                          canvasHeight,
                          date,
                          privateFromFriends,
                        })
                      }
                      onDelete={() => removeEntry(selectedEntry.id)}
                      onExport={() => exportEntry(selectedEntry)}
                      // patchEntry parte sempre da versao mais recente em memoria: um
                      // upload lento nao repoe o texto antigo nem perde outra foto.
                      onUploadPhoto={async (file) => {
                        const photo = await uploadNotebookPhoto(selectedEntry.id, file);
                        patchEntry(selectedEntry.id, (latest) => ({ ...latest, photos: [...latest.photos, photo] }));
                      }}
                      onDeletePhoto={async (photoId) => {
                        await deleteNotebookPhoto(selectedEntry.id, photoId);
                        patchEntry(selectedEntry.id, (latest) => ({
                          ...latest,
                          photos: latest.photos.filter((p) => p.id !== photoId),
                        }));
                      }}
                      onUploadAttachment={async (file) => {
                        const attachment = await uploadNotebookAttachment(selectedEntry.id, file);
                        patchEntry(selectedEntry.id, (latest) => ({
                          ...latest,
                          attachments: [...latest.attachments, attachment],
                        }));
                      }}
                      onDeleteAttachment={async (attachmentId) => {
                        await deleteNotebookAttachment(selectedEntry.id, attachmentId);
                        patchEntry(selectedEntry.id, (latest) => ({
                          ...latest,
                          attachments: latest.attachments.filter((a) => a.id !== attachmentId),
                        }));
                      }}
                    />
                  ) : isLoadingEntry ? (
                    // So a entrada aberta vem com o conteudo (ver useNotebookEntries).
                    <div role="status" aria-label={t('notebook.entry.loading')} className="rounded-xl border border-neutral-800 p-5">
                      <LinesSkeleton lines={6} />
                    </div>
                  ) : entryError ? (
                    <div className="space-y-3">
                      <ErrorState message={entryError} />
                      <Button type="button" variant="secondary" onClick={retryEntry} size="sm">
                        {t('common.tryAgain')}
                      </Button>
                    </div>
                  ) : entriesLoading ? (
                    <LinesSkeleton lines={6} />
                  ) : (
                    <NotebookAreaOverview
                      entries={entries}
                      isCreating={isCreating}
                      onSelect={selectEntry}
                      onNewEntry={() => void handleNewEntry()}
                    />
                  )}
                </div>
              </div>
              )}
            </div>
          )}
        </>
      )}
    </PageLayout>
  );
}
