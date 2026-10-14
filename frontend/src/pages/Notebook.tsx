import { useEffect, useMemo, useState } from 'react';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import Button from '../components/UI/Button';
import EmptyState from '../components/UI/EmptyState';
import { useI18n } from '../i18n/useI18n';
import LoadingState from '../components/UI/LoadingState';
import ErrorState from '../components/UI/ErrorState';
import NotebookSubjectPicker from '../components/Notebook/NotebookSubjectPicker';
import NotebookEntryList from '../components/Notebook/NotebookEntryList';
import NotebookEntryEditor from '../components/Notebook/NotebookEntryEditor';
import NotebookScheduleLink from '../components/Notebook/NotebookScheduleLink';
import NotebookSearchResults from '../components/Notebook/NotebookSearchResults';
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
} from '../api/notebookService';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { PlusIcon, SearchIcon, XIcon } from '../components/UI/Icons';
import { consumePendingNotebookEntry } from '../lib/pendingNotebookEntry';
import type { NotebookSearchResult } from '../types/models';

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
    selectedEntry,
    selectEntry,
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
        date: new Date().toISOString(),
      }).then((created) => setJustCreatedEntryId(created.id));
    } catch {
      setCreateError(t('notebook.createError'));
    } finally {
      setIsCreating(false);
    }
  };

  // --- Pesquisa global --------------------------------------------------
  const [searchQuery, setSearchQuery] = useState('');
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

  // Vinda do Command Palette global (Cmd/Ctrl+K -> resultado de notebook):
  // consome a entrada deixada em sessionStorage e abre-a, uma única vez,
  // logo ao entrar na página - ver lib/pendingNotebookEntry.ts.
  useEffect(() => {
    const pending = consumePendingNotebookEntry();
    if (pending) handleSelectSearchResult(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isSearchActive = searchQuery.trim().length > 0;

  return (
    <PageLayout>
      <PageHeader title={t('notebook.title')} description={t('notebook.description')} />

      <div className="relative mb-6">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('notebook.search.placeholder')}
          aria-label={t('notebook.search.placeholder')}
          className="w-full rounded-lg border border-neutral-800 bg-neutral-900 py-2.5 pl-10 pr-9 text-sm text-neutral-100 placeholder-neutral-600 focus:border-violet-500 focus:outline-none"
        />
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
            <LoadingState message={t('notebook.subjects.loading')} />
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
                        {t('notebook.entries.count', { count: entries.length })}
                      </span>
                    )}
                    <NotebookScheduleLink areaId={selectedArea.id} />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {createError && <span className="text-xs text-red-400">{createError}</span>}
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

              <div className="grid grid-cols-1 gap-6 md:grid-cols-[16rem_minmax(0,1fr)] lg:grid-cols-[18rem_minmax(0,1fr)]">
                <div className="md:sticky md:top-20 md:max-h-[calc(100vh-6rem)] md:self-start md:overflow-y-auto md:pr-1">
                  {entriesLoading ? (
                    <LoadingState message={t('notebook.entries.loading')} />
                  ) : (
                    <NotebookEntryList
                      entries={entries}
                      selectedId={selectedEntry?.id ?? null}
                      onSelect={(entry) => {
                        selectEntry(entry);
                        setJustCreatedEntryId(null);
                      }}
                    />
                  )}
                </div>

                <div className="min-w-0">
                  {selectedEntry ? (
                    <NotebookEntryEditor
                      key={selectedEntry.id}
                      entry={selectedEntry}
                      suggestedClassNumber={nextClassNumber}
                      startInEditMode={selectedEntry.id === justCreatedEntryId}
                      onSave={({ title, entryType, classNumber, textContent, drawingStrokes, tables, canvasShapes, canvasLinks, canvasTexts, usefulLinks, canvasHeight, date }) =>
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
                        })
                      }
                      onDelete={() => removeEntry(selectedEntry.id)}
                      onUploadPhoto={async (file) => {
                        const photo = await uploadNotebookPhoto(selectedEntry.id, file);
                        selectEntry({
                          ...selectedEntry,
                          photos: [...selectedEntry.photos, photo],
                        });
                      }}
                      onDeletePhoto={async (photoId) => {
                        await deleteNotebookPhoto(selectedEntry.id, photoId);
                        selectEntry({
                          ...selectedEntry,
                          photos: selectedEntry.photos.filter((p) => p.id !== photoId),
                        });
                      }}
                      onUploadAttachment={async (file) => {
                        const attachment = await uploadNotebookAttachment(selectedEntry.id, file);
                        selectEntry({
                          ...selectedEntry,
                          attachments: [...selectedEntry.attachments, attachment],
                        });
                      }}
                      onDeleteAttachment={async (attachmentId) => {
                        await deleteNotebookAttachment(selectedEntry.id, attachmentId);
                        selectEntry({
                          ...selectedEntry,
                          attachments: selectedEntry.attachments.filter((a) => a.id !== attachmentId),
                        });
                      }}
                    />
                  ) : (
                    <EmptyState message={t('notebook.entries.select')} />
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </PageLayout>
  );
}
