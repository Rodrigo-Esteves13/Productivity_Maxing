import { useState } from 'react';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import ActionButton from '../components/UI/ActionButton';
import LoadingState from '../components/UI/LoadingState';
import NotebookEntryList from '../components/Notebook/NotebookEntryList';
import NotebookEntryEditor from '../components/Notebook/NotebookEntryEditor';
import NotebookScheduleLink from '../components/Notebook/NotebookScheduleLink';
import { useNotebookAreas } from '../hooks/useNotebookAreas';
import { useNotebookEntries } from '../hooks/useNotebookEntries';
import { detectClassNow, uploadNotebookPhoto, deleteNotebookPhoto } from '../api/notebookService';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { BookOpenIcon } from '../components/UI/Icons';

export default function Notebook() {
  useDocumentTitle('Notebook');
  const { areas, isLoading: areasLoading } = useNotebookAreas();
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

  const selectedArea = areas.find((a) => a.id === selectedAreaId) ?? null;

  const handleNewEntry = async () => {
    if (!selectedAreaId) return;
    setIsCreating(true);
    try {
      // Só verifica "há aula agora" no momento de criar, não em segundo
      // plano - ver comentário em NotebookService.detectClassNow no backend.
      const detection = await detectClassNow(selectedAreaId).catch(() => ({
        occurrence: null,
        suggestedTitle: null,
      }));

      await createEntry({
        areaId: selectedAreaId,
        classOccurrenceId: detection.occurrence?.id,
        title: detection.suggestedTitle ?? '',
        date: new Date().toISOString(),
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <PageLayout>
      <PageHeader
        title="Notebook"
        description="Notes, hand-drawn sketches and photos for each subject, in one place."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <div className="space-y-1 lg:col-span-1">
          <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-neutral-500">
            Subjects
          </span>
          {areasLoading ? (
            <LoadingState message="Loading subjects..." />
          ) : areas.length === 0 ? (
            <p className="text-sm text-neutral-500">
              No areas yet. Create one first in Areas.
            </p>
          ) : (
            <ul className="space-y-1">
              {areas.map((area) => (
                <li key={area.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAreaId(area.id);
                      selectEntry(null);
                    }}
                    className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                      area.id === selectedAreaId
                        ? 'bg-neutral-800 text-white'
                        : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
                    }`}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: area.colorHex }}
                    />
                    <span className="truncate">{area.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="lg:col-span-3">
          {!selectedArea ? (
            <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-800 text-neutral-500">
              <BookOpenIcon className="h-8 w-8 opacity-50" />
              <p className="text-sm">Pick a subject to open its notebook.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <NotebookScheduleLink areaId={selectedArea.id} />
                <ActionButton onClick={handleNewEntry} disabled={isCreating}>
                  {isCreating ? 'Checking schedule...' : 'New entry'}
                </ActionButton>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <div className="md:col-span-1">
                  {entriesLoading ? (
                    <LoadingState message="Loading entries..." />
                  ) : (
                    <NotebookEntryList
                      entries={entries}
                      selectedId={selectedEntry?.id ?? null}
                      onSelect={selectEntry}
                    />
                  )}
                </div>

                <div className="md:col-span-2">
                  {selectedEntry ? (
                    <NotebookEntryEditor
                      key={selectedEntry.id}
                      entry={selectedEntry}
                      onSave={({ title, textContent, drawingStrokes }) =>
                        updateEntry(selectedEntry.id, { title, textContent, drawingStrokes })
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
        </div>
      </div>
    </PageLayout>
  );
}
