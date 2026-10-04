import { useState } from 'react';
import type { NotebookEntry } from '../../types/models';
import { useDrawingCanvas } from '../../hooks/useDrawingCanvas';
import { useCanvasShapes } from '../../hooks/useCanvasShapes';
import { useCanvasLinks } from '../../hooks/useCanvasLinks';
import { useCanvasTexts } from '../../hooks/useCanvasTexts';
import { useTextareaInsertion } from '../../hooks/useTextareaInsertion';
import { useEntryDraft } from '../../hooks/useEntryDraft';
import { useEntrySave } from '../../hooks/useEntrySave';
import { useConfirmDelete } from '../../hooks/useConfirmDelete';
import NotebookCanvas from './NotebookCanvas';
import DeleteEntryModal from './DeleteEntryModal';
import NotebookEntryShare from './NotebookEntryShare';
import EntryHeader from './entry/EntryHeader';
import EntryMetaBar from './entry/EntryMetaBar';
import EntryNotesSection from './entry/EntryNotesSection';
import UsefulLinksSection from './entry/UsefulLinksSection';
import { AttachmentsSection, PhotosSection } from './entry/EntryFilesSection';
import EntrySaveBar from './entry/EntrySaveBar';
import { MAX_TEXT_CONTENT_LENGTH } from './entry/notebookEntryConfig';
import type { NotebookEntrySavePayload } from './entry/entryTypes';

interface NotebookEntryEditorProps {
  entry: NotebookEntry;
  // Maior classNumber já usado nesta Area (entre entradas CLASS) + 1 -
  // calculado em Notebook.tsx a partir das entradas já carregadas, só
  // usado como placeholder/sugestão quando o campo está vazio, nunca
  // força o valor.
  suggestedClassNumber: number;
  // True só na entrada acabada de criar (Notebook.tsx compara o id com o
  // que guardou no momento da criação) - nada para estragar, por isso
  // abre logo em edição em vez do modo leitura por omissão.
  startInEditMode?: boolean;
  onSave: (payload: NotebookEntrySavePayload) => Promise<void>;
  onDelete: () => Promise<void>;
  onUploadPhoto: (file: File) => Promise<void>;
  onDeletePhoto: (photoId: string) => Promise<void>;
  onUploadAttachment: (file: File) => Promise<void>;
  onDeleteAttachment: (attachmentId: string) => Promise<void>;
}

// Wrapper fino: só gere se estamos em modo leitura ou edição. Abre
// sempre em leitura (medo de mexer sem querer numa entrada só ao
// consultá-la) - "Edit" muda para edição; "Cancel" volta a leitura E
// força o formulário a remontar (key={resetToken}), o que reinicia TODO
// o estado interno (título, texto, tabelas, canvas, formas, ligações) a
// partir de `entry` outra vez - descarta mesmo tudo o que não foi
// guardado, não só os campos simples.
export default function NotebookEntryEditor({
  entry,
  suggestedClassNumber,
  startInEditMode = false,
  onSave,
  ...handlers
}: NotebookEntryEditorProps) {
  const [isEditing, setIsEditing] = useState(startInEditMode);
  const [resetToken, setResetToken] = useState(0);

  return (
    <NotebookEntryEditorForm
      key={resetToken}
      entry={entry}
      suggestedClassNumber={suggestedClassNumber}
      isEditing={isEditing}
      onRequestEdit={() => setIsEditing(true)}
      onCancelEdit={() => {
        setIsEditing(false);
        setResetToken((t) => t + 1);
      }}
      onSave={async (payload) => {
        await onSave(payload);
        setIsEditing(false);
      }}
      {...handlers}
    />
  );
}

interface NotebookEntryEditorFormProps extends Omit<NotebookEntryEditorProps, 'startInEditMode'> {
  isEditing: boolean;
  onRequestEdit: () => void;
  onCancelEdit: () => void;
}

function NotebookEntryEditorForm({
  entry,
  suggestedClassNumber,
  isEditing,
  onRequestEdit,
  onCancelEdit,
  onSave,
  onDelete,
  onUploadPhoto,
  onDeletePhoto,
  onUploadAttachment,
  onDeleteAttachment,
}: NotebookEntryEditorFormProps) {
  const draft = useEntryDraft(entry);
  const canvas = useDrawingCanvas(entry.drawingStrokes ?? []);
  const shapeLayer = useCanvasShapes(entry.canvasShapes ?? []);
  const linkLayer = useCanvasLinks(entry.canvasLinks ?? []);
  const textLayer = useCanvasTexts(entry.canvasTexts ?? []);
  const { textareaRef, insertAtCursor } = useTextareaInsertion(draft.textContent, draft.setTextContent);
  const { isSaving, saveError, save } = useEntrySave(onSave, draft.textContent.length);
  const deletion = useConfirmDelete(onDelete);

  const handleSave = () => {
    const parsedClassNumber = draft.classNumber.trim() ? Number(draft.classNumber) : undefined;
    return save({
      title: draft.title,
      entryType: draft.entryType,
      classNumber: draft.entryType === 'CLASS' ? parsedClassNumber : undefined,
      textContent: draft.textContent,
      drawingStrokes: canvas.strokes,
      tables: draft.tables,
      canvasShapes: shapeLayer.shapes,
      canvasLinks: linkLayer.links,
      canvasTexts: textLayer.texts,
      usefulLinks: draft.usefulLinks,
      canvasHeight: draft.canvasHeight,
      // Meio-dia local evita a data saltar um dia por causa do
      // arredondamento UTC - o utilizador escolheu um DIA, não uma hora.
      date: new Date(`${draft.dateValue}T12:00:00`).toISOString(),
    });
  };

  return (
    <>
      <div className="space-y-4">
        <EntryHeader
          title={draft.title}
          isEditing={isEditing}
          onTitleChange={draft.setTitle}
          onRequestEdit={onRequestEdit}
          onCancelEdit={onCancelEdit}
          onRequestDelete={deletion.request}
        />

        <NotebookEntryShare entryId={entry.id} />

        <EntryMetaBar
          isEditing={isEditing}
          entryType={draft.entryType}
          classNumber={draft.classNumber}
          dateValue={draft.dateValue}
          suggestedClassNumber={suggestedClassNumber}
          onEntryTypeChange={draft.setEntryType}
          onClassNumberChange={draft.setClassNumber}
          onDateChange={draft.setDateValue}
        />

        <EntryNotesSection
          isEditing={isEditing}
          textContent={draft.textContent}
          onTextChange={draft.setTextContent}
          textareaRef={textareaRef}
          onInsert={insertAtCursor}
          tables={draft.tables}
          onTablesChange={draft.setTables}
          onAddTable={draft.addTable}
        />

        <UsefulLinksSection isEditing={isEditing} links={draft.usefulLinks} onChange={draft.setUsefulLinks} />

        <NotebookCanvas
          canvas={canvas}
          shapes={shapeLayer}
          links={linkLayer}
          texts={textLayer}
          readOnly={!isEditing}
          canvasHeight={draft.canvasHeight}
          onGrowCanvas={isEditing ? draft.growCanvas : undefined}
        />

        <AttachmentsSection
          isEditing={isEditing}
          attachments={entry.attachments}
          onUpload={onUploadAttachment}
          onDelete={onDeleteAttachment}
        />

        <PhotosSection isEditing={isEditing} photos={entry.photos} onUpload={onUploadPhoto} onDelete={onDeletePhoto} />

        {isEditing && (
          <EntrySaveBar
            error={saveError}
            isSaving={isSaving}
            isDisabled={draft.textContent.length > MAX_TEXT_CONTENT_LENGTH}
            onSave={() => void handleSave()}
          />
        )}
      </div>

      {deletion.isConfirming && (
        <DeleteEntryModal
          isDeleting={deletion.isDeleting}
          onCancel={deletion.cancel}
          onConfirm={() => void deletion.confirm()}
        />
      )}
    </>
  );
}
