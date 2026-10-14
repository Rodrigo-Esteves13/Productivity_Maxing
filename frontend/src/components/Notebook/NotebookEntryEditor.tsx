import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeProposalFields, NotebookEntry } from '../../types/models';
import { useDrawingCanvas } from '../../hooks/useDrawingCanvas';
import { useCanvasShapes } from '../../hooks/useCanvasShapes';
import { useCanvasLinks } from '../../hooks/useCanvasLinks';
import { useCanvasTexts } from '../../hooks/useCanvasTexts';
import { useTextareaInsertion } from '../../hooks/useTextareaInsertion';
import { useEntryDraft } from '../../hooks/useEntryDraft';
import { useEntryAutosave } from '../../hooks/useEntryAutosave';
import { useConfirmDelete } from '../../hooks/useConfirmDelete';
import { useEntryShare } from '../../hooks/useEntryShare';
import type { UseEntryShareResult } from '../../hooks/useEntryShare';
import DeleteEntryModal from './DeleteEntryModal';
import NotebookEntryShare from './NotebookEntryShare';
import EntrySheet from './entry/EntrySheet';
import EntryToolbar from './entry/EntryToolbar';
import EntryTitle from './entry/EntryTitle';
import WhiteboardSection from './entry/WhiteboardSection';
import EntryNotesSection from './entry/EntryNotesSection';
import UsefulLinksSection from './entry/UsefulLinksSection';
import { AttachmentsSection, PhotosSection } from './entry/EntryFilesSection';
import { MAX_TEXT_CONTENT_LENGTH } from './entry/notebookEntryConfig';
import type { NotebookEntrySavePayload } from './entry/entryTypes';

interface NotebookEntryEditorProps {
  entry: NotebookEntry;
  // Maior classNumber já usado nesta Area (entre entradas CLASS) + 1 -
  // calculado em Notebook.tsx a partir das entradas já carregadas, só
  // usado como placeholder/sugestão quando o campo está vazio, nunca
  // força o valor.
  suggestedClassNumber: number;
  // True só na entrada acabada de criar - nada para estragar, por isso
  // abre logo em edição em vez do modo leitura por omissão.
  startInEditMode?: boolean;
  // Chamado pelo auto save (e por "Done"/Ctrl+S). Nunca fecha a edição.
  onSave: (payload: NotebookEntrySavePayload) => Promise<void>;
  onDelete: () => Promise<void>;
  onUploadPhoto: (file: File) => Promise<void>;
  onDeletePhoto: (photoId: string) => Promise<void>;
  onUploadAttachment: (file: File) => Promise<void>;
  onDeleteAttachment: (attachmentId: string) => Promise<void>;
}

// Wrapper fino: só gere leitura vs edição. Abre sempre em leitura (medo de
// mexer sem querer numa entrada só ao consultá-la). Em edição tudo é
// gravado sozinho (useEntryAutosave); "Done" grava o que falta e volta à
// leitura.
export default function NotebookEntryEditor({
  entry,
  suggestedClassNumber,
  startInEditMode = false,
  onSave,
  ...handlers
}: NotebookEntryEditorProps) {
  const [isEditing, setIsEditing] = useState(startInEditMode);
  // Uma proposta de um editor aprovada muda titulo/notas no servidor: o
  // formulario recebe-as aqui para o rascunho (e o auto save) as manter.
  const [applied, setApplied] = useState<{ seq: number; fields: ChangeProposalFields } | null>(null);
  const share = useEntryShare(entry.id, (fields) =>
    setApplied((prev) => ({ seq: (prev?.seq ?? 0) + 1, fields })),
  );

  return (
    <NotebookEntryEditorForm
      entry={entry}
      share={share}
      appliedChanges={applied}
      suggestedClassNumber={suggestedClassNumber}
      isEditing={isEditing}
      onRequestEdit={() => setIsEditing(true)}
      onFinishEdit={() => setIsEditing(false)}
      onSave={onSave}
      {...handlers}
    />
  );
}

interface NotebookEntryEditorFormProps extends Omit<NotebookEntryEditorProps, 'startInEditMode'> {
  share: UseEntryShareResult;
  appliedChanges: { seq: number; fields: ChangeProposalFields } | null;
  isEditing: boolean;
  onRequestEdit: () => void;
  onFinishEdit: () => void;
}

function NotebookEntryEditorForm({
  entry,
  share,
  appliedChanges,
  suggestedClassNumber,
  isEditing,
  onRequestEdit,
  onFinishEdit,
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
  const deletion = useConfirmDelete(onDelete);

  // Aplica ao rascunho o que uma proposta aprovada mudou no servidor.
  useEffect(() => {
    if (!appliedChanges) return;
    const { title, textContent, usefulLinks } = appliedChanges.fields;
    if (title !== undefined) draft.setTitle(title);
    if (textContent !== undefined) draft.setTextContent(textContent);
    if (usefulLinks !== undefined) draft.setUsefulLinks(usefulLinks);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- so reage a uma nova proposta aplicada (seq)
  }, [appliedChanges?.seq]);

  // Data original so serve de fallback se o campo da data ficar invalido;
  // em ref para a resposta do servidor nao refazer o payload.
  const fallbackDateRef = useRef(entry.date);

  const payload = useMemo<NotebookEntrySavePayload>(() => {
    const parsedClassNumber = draft.classNumber.trim() ? Number(draft.classNumber) : undefined;
    // Meio-dia local evita a data saltar um dia por causa do arredondamento
    // UTC - o utilizador escolheu um DIA, não uma hora.
    const parsedDate = new Date(`${draft.dateValue}T12:00:00`);
    return {
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
      date: Number.isNaN(parsedDate.getTime()) ? fallbackDateRef.current : parsedDate.toISOString(),
    };
  }, [
    draft.title,
    draft.entryType,
    draft.classNumber,
    draft.textContent,
    draft.tables,
    draft.usefulLinks,
    draft.canvasHeight,
    draft.dateValue,
    canvas.strokes,
    shapeLayer.shapes,
    linkLayer.links,
    textLayer.texts,
  ]);

  const autosave = useEntryAutosave({
    enabled: isEditing,
    payload,
    blocked: draft.textContent.length > MAX_TEXT_CONTENT_LENGTH,
    textLength: draft.textContent.length,
    onSave,
  });

  const handleDone = async () => {
    const ok = await autosave.flush();
    if (ok) onFinishEdit();
  };

  // Ctrl/Cmd+S grava já (sem esperar pelo auto save). A ref evita
  // re-registar o listener a cada render.
  const flushRef = useRef(autosave.flush);
  flushRef.current = autosave.flush;
  useEffect(() => {
    if (!isEditing) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void flushRef.current();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isEditing]);

  return (
    <>
      <EntrySheet
        toolbar={
          <EntryToolbar
            isEditing={isEditing}
            entryType={draft.entryType}
            classNumber={draft.classNumber}
            dateValue={draft.dateValue}
            suggestedClassNumber={suggestedClassNumber}
            autosaveStatus={autosave.status}
            autosaveSavedAt={autosave.savedAt}
            autosaveError={autosave.error}
            isDoneDisabled={autosave.status === 'saving'}
            onEntryTypeChange={draft.setEntryType}
            onClassNumberChange={draft.setClassNumber}
            onDateChange={draft.setDateValue}
            onRequestEdit={onRequestEdit}
            onDone={() => void handleDone()}
            onRetry={() => void autosave.flush()}
            onRequestDelete={deletion.request}
          />
        }
      >
        <div className="space-y-3">
          <EntryTitle title={draft.title} isEditing={isEditing} onTitleChange={draft.setTitle} />
          <NotebookEntryShare share={share} currentTitle={draft.title} currentText={draft.textContent} />
        </div>

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

        <WhiteboardSection
          canvas={canvas}
          shapes={shapeLayer}
          links={linkLayer}
          texts={textLayer}
          isEditing={isEditing}
          canvasHeight={draft.canvasHeight}
          onGrowCanvas={draft.growCanvas}
        />

        <AttachmentsSection
          isEditing={isEditing}
          attachments={entry.attachments}
          onUpload={onUploadAttachment}
          onDelete={onDeleteAttachment}
        />

        <PhotosSection isEditing={isEditing} photos={entry.photos} onUpload={onUploadPhoto} onDelete={onDeletePhoto} />
      </EntrySheet>

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
