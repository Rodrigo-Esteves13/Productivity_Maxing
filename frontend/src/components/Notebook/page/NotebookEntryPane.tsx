import { useI18n } from '../../../i18n/useI18n';
import {
  deleteNotebookAttachment,
  deleteNotebookPhoto,
  uploadNotebookAttachment,
  uploadNotebookPhoto,
} from '../../../api/notebookService';
import Button from '../../UI/Button';
import ErrorState from '../../UI/ErrorState';
import LinesSkeleton from '../../UI/LinesSkeleton';
import NotebookAreaOverview from '../NotebookAreaOverview';
import NotebookEntryEditor from '../NotebookEntryEditor';
import type { NotebookPageState } from '../../../hooks/useNotebookPage';

// Coluna da direita: o editor da nota aberta, o seu estado de carga ou o
// resumo da cadeira.
export default function NotebookEntryPane({ page }: { page: NotebookPageState }) {
  const { t } = useI18n();
  const {
    entries,
    isLoading: entriesLoading,
    selectedEntry,
    isLoadingEntry,
    entryError,
    retryEntry,
    selectEntry,
    replaceEntry,
    patchEntry,
    reloadEntry,
    updateEntry,
    removeEntry,
    reopened,
    reopenEntry,
    justCreatedEntryId,
    nextClassNumber,
    isCreating,
    handleNewEntry,
    exportEntry,
  } = page;

  if (selectedEntry) {
    return (
      <NotebookEntryEditor
        key={`${selectedEntry.id}:${reopened?.id === selectedEntry.id ? reopened.seq : 0}`}
        entry={selectedEntry}
        suggestedClassNumber={nextClassNumber}
        startInEditMode={selectedEntry.id === justCreatedEntryId || reopened?.id === selectedEntry.id}
        onAdoptServerVersion={replaceEntry}
        onReopen={() => reopenEntry(selectedEntry.id)}
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
    );
  }

  if (isLoadingEntry) {
    // So a entrada aberta vem com o conteudo (ver useNotebookEntries).
    return (
      <div role="status" aria-label={t('notebook.entry.loading')} className="rounded-xl border border-neutral-800 p-5">
        <LinesSkeleton lines={6} />
      </div>
    );
  }

  if (entryError) {
    return (
      <div className="space-y-3">
        <ErrorState message={entryError} />
        <Button type="button" variant="secondary" onClick={retryEntry} size="sm">
          {t('common.tryAgain')}
        </Button>
      </div>
    );
  }

  if (entriesLoading) return <LinesSkeleton lines={6} />;

  return (
    <NotebookAreaOverview
      entries={entries}
      isCreating={isCreating}
      onSelect={selectEntry}
      onNewEntry={() => void handleNewEntry()}
    />
  );
}
