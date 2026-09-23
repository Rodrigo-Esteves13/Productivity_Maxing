import { useEffect, useMemo, useState } from 'react';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import ActionButton from '../components/UI/ActionButton';
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
  uploadNotebookPhoto,
  deleteNotebookPhoto,
  uploadNotebookAttachment,
  deleteNotebookAttachment,
  searchNotebook,
} from '../api/notebookService';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { BookOpenIcon, SearchIcon, XIcon } from '../components/UI/Icons';
import { consumePendingNotebookEntry } from '../lib/pendingNotebookEntry';
import type { NotebookSearchResult } from '../types/models';

// Título nunca pode ficar vazio (o backend exige @IsNotEmpty) - sem aula
// detetada, usa a data por extenso em vez de deixar em branco.
function buildFallbackTitle(): string {
  const label = new Date().toLocaleDateString('pt-PT', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// Debounce simples da pesquisa - evita um pedido por tecla premida.
const SEARCH_DEBOUNCE_MS = 300;

export default function Notebook() {
  useDocumentTitle('Notebook');
  const { activePeriod, isViewingAllPeriods, isViewingAllPrograms } = useAcademic();
  // Mesma regra que useTasksPage.ts usa para as tasks: 'all' quando o
  // utilizador está deliberadamente a ver tudo, senão o período ativo.
  const periodParam = isViewingAllPeriods || isViewingAllPrograms ? 'all' : activePeriod?.id;
  const groupByPeriod = Boolean(periodParam) && periodParam !== 'all';

  const { areas, isLoading: areasLoading, error: areasError } = useNotebookAreas(periodParam);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
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

      await createEntry({
        areaId: selectedAreaId,
        classOccurrenceId: detection.occurrence?.id,
        entryType: isClassNow ? 'CLASS' : 'NOTE',
        classNumber: isClassNow ? nextClassNumber : undefined,
        title: buildFallbackTitle(),
        date: new Date().toISOString(),
      }).then((created) => setJustCreatedEntryId(created.id));
    } catch {
      setCreateError('Could not create the entry. Please try again.');
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
      <PageHeader
        title="Notebook"
        description="Notes, hand-drawn sketches and photos for each subject, in one place."
      />

      <div className="relative mb-6">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by subject, date, or content..."
          className="w-full rounded-lg border border-neutral-800 bg-neutral-900 py-2.5 pl-10 pr-9 text-sm text-neutral-100 placeholder-neutral-600 focus:border-violet-500 focus:outline-none"
        />
        {isSearchActive && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
            aria-label="Clear search"
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
          <div className="space-y-2">
            <span className="block text-xs font-medium uppercase tracking-wide text-neutral-500">
              Subjects
            </span>
            {areasLoading ? (
              <LoadingState message="Loading subjects..." />
            ) : areasError ? (
              <ErrorState message={areasError} />
            ) : areas.length === 0 ? (
              <p className="text-sm text-neutral-500">No areas yet. Create one first in Areas.</p>
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
          </div>

          <div className="my-6 border-t border-neutral-900" />

          {!selectedArea ? (
            <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-800 text-neutral-500">
              <BookOpenIcon className="h-8 w-8 opacity-50" />
              <p className="text-sm">Pick a subject above to open its notebook.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <NotebookScheduleLink areaId={selectedArea.id} />
                <div className="flex items-center gap-3">
                  {createError && <span className="text-xs text-red-400">{createError}</span>}
                  <ActionButton onClick={handleNewEntry} disabled={isCreating}>
                    {isCreating ? 'Checking schedule...' : 'New entry'}
                  </ActionButton>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <div className="md:col-span-1">
                  {entriesLoading ? (
                    <LoadingState message="Loading entries..." />
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

                <div className="md:col-span-2">
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
                    <p className="rounded-lg border border-dashed border-neutral-800 p-6 text-center text-sm text-neutral-500">
                      Select an entry on the left, or start a new one.
                    </p>
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
