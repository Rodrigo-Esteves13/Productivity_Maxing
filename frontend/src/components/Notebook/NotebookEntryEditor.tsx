import { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import type {
  CanvasLink,
  CanvasShape,
  CanvasTextItem,
  NotebookEntry,
  NotebookEntryType,
  NotebookTable,
  Stroke,
} from '../../types/models';
import { useDrawingCanvas } from '../../hooks/useDrawingCanvas';
import { useCanvasShapes } from '../../hooks/useCanvasShapes';
import { useCanvasLinks } from '../../hooks/useCanvasLinks';
import { useCanvasTexts } from '../../hooks/useCanvasTexts';
import { useTextareaInsertion } from '../../hooks/useTextareaInsertion';
import NotebookCanvas from './NotebookCanvas';
import NotebookToolsPanel from './NotebookToolsPanel';
import NotebookTableEditor from './NotebookTableEditor';
import DeleteEntryModal from './DeleteEntryModal';
import { TrashIcon, ImageIcon, XIcon, CheckIcon, TableIcon, PencilIcon } from '../UI/Icons';

interface NotebookEntryEditorSavePayload {
  title: string;
  entryType: NotebookEntryType;
  classNumber?: number;
  textContent: string;
  drawingStrokes: Stroke[];
  tables: NotebookTable[];
  canvasShapes: CanvasShape[];
  canvasLinks: CanvasLink[];
  canvasTexts: CanvasTextItem[];
  date: string;
}

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
  onSave: (payload: NotebookEntryEditorSavePayload) => Promise<void>;
  onDelete: () => Promise<void>;
  onUploadPhoto: (file: File) => Promise<void>;
  onDeletePhoto: (photoId: string) => Promise<void>;
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
  onDelete,
  onUploadPhoto,
  onDeletePhoto,
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
      onDelete={onDelete}
      onUploadPhoto={onUploadPhoto}
      onDeletePhoto={onDeletePhoto}
    />
  );
}

interface NotebookEntryEditorFormProps extends NotebookEntryEditorProps {
  isEditing: boolean;
  onRequestEdit: () => void;
  onCancelEdit: () => void;
}

const MAX_PHOTO_SIZE = 8 * 1024 * 1024;
const ACCEPTED_PHOTO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

const TYPE_OPTIONS: { value: NotebookEntryType; label: string }[] = [
  { value: 'NOTE', label: 'Note' },
  { value: 'STUDY', label: 'Study' },
  { value: 'CLASS', label: 'Class' },
];

function toDateInputValue(iso: string): string {
  return iso.slice(0, 10);
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
}: NotebookEntryEditorFormProps) {
  const [title, setTitle] = useState(entry.title);
  const [entryType, setEntryType] = useState<NotebookEntryType>(entry.entryType);
  const [classNumber, setClassNumber] = useState<string>(
    entry.classNumber != null ? String(entry.classNumber) : '',
  );
  const [dateValue, setDateValue] = useState(toDateInputValue(entry.date));
  const [textContent, setTextContent] = useState(entry.textContent ?? '');
  const [tables, setTables] = useState<NotebookTable[]>(entry.tables ?? []);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [isToolsPanelOpen, setIsToolsPanelOpen] = useState(false);
  const canvas = useDrawingCanvas(entry.drawingStrokes ?? []);
  const shapeLayer = useCanvasShapes(entry.canvasShapes ?? []);
  const linkLayer = useCanvasLinks(entry.canvasLinks ?? []);
  const textLayer = useCanvasTexts(entry.canvasTexts ?? []);
  const { textareaRef, insertAtCursor } = useTextareaInsertion(textContent, setTextContent);

  const handleAddTable = (rows: number, cols: number) => {
    const safeRows = Math.min(Math.max(rows, 1), 30);
    const safeCols = Math.min(Math.max(cols, 1), 12);
    const newTable: NotebookTable = {
      id: crypto.randomUUID(),
      rows: Array.from({ length: safeRows }, () => Array.from({ length: safeCols }, () => '')),
    };
    setTables((prev) => [...prev, newTable]);
  };

  // Trocar de entrada (outro item da lista) tem de repor o editor inteiro -
  // sem isto os campos da entrada anterior "vazavam" para a seguinte até
  // o utilizador tocar em cada um.
  useEffect(() => {
    setTitle(entry.title);
    setEntryType(entry.entryType);
    setClassNumber(entry.classNumber != null ? String(entry.classNumber) : '');
    setDateValue(toDateInputValue(entry.date));
    setTextContent(entry.textContent ?? '');
    setTables(entry.tables ?? []);
  }, [entry.id, entry.title, entry.entryType, entry.classNumber, entry.date, entry.textContent, entry.tables]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const parsedClassNumber = classNumber.trim() ? Number(classNumber) : undefined;
      await onSave({
        title,
        entryType,
        classNumber: entryType === 'CLASS' ? parsedClassNumber : undefined,
        textContent,
        drawingStrokes: canvas.strokes,
        tables,
        canvasShapes: shapeLayer.shapes,
        canvasLinks: linkLayer.links,
        canvasTexts: textLayer.texts,
        // Meio-dia local evita a data saltar um dia por causa do
        // arredondamento UTC - o utilizador escolheu um DIA, não uma hora.
        date: new Date(`${dateValue}T12:00:00`).toISOString(),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
      setIsConfirmingDelete(false);
    }
  };

  const handlePhotoChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!ACCEPTED_PHOTO_TYPES.includes(file.type)) {
      setPhotoError('Use PNG, JPG or WEBP.');
      return;
    }
    if (file.size > MAX_PHOTO_SIZE) {
      setPhotoError('Photo must be under 8MB.');
      return;
    }

    setPhotoError('');
    try {
      await onUploadPhoto(file);
    } catch {
      setPhotoError('Could not upload the photo. Please try again.');
    }
  };

  return (
    <>
      <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        {isEditing ? (
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Entry title"
            className="w-full bg-transparent text-lg font-semibold text-white placeholder-neutral-600 focus:outline-none"
          />
        ) : (
          <h2 className="text-lg font-semibold text-white">{title || 'Untitled entry'}</h2>
        )}

        <div className="flex shrink-0 items-center gap-1">
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(true)}
                className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-red-400"
                aria-label="Delete entry"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onCancelEdit}
                className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-neutral-300 hover:bg-neutral-800"
              >
                <XIcon className="h-4 w-4" />
                Cancel
              </button>
            </>
          ) : (
            // Só o botão "Edit" enquanto não se ativa o modo edição - de
            // propósito, para nunca ser possível mexer (nem apagar) numa
            // entrada só de a estar a consultar.
            <button
              type="button"
              onClick={onRequestEdit}
              className="flex items-center gap-1 rounded-md bg-neutral-800 px-2.5 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-700"
            >
              <PencilIcon className="h-3.5 w-3.5" />
              Edit
            </button>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-md border border-neutral-800 bg-neutral-900 p-0.5">
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setEntryType(opt.value)}
                aria-pressed={entryType === opt.value}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  entryType === opt.value
                    ? 'bg-violet-600 text-white'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {entryType === 'CLASS' && (
            <label className="flex items-center gap-1.5 text-xs text-neutral-400">
              Class #
              <input
                type="number"
                min={1}
                value={classNumber}
                onChange={(e) => setClassNumber(e.target.value)}
                placeholder={String(suggestedClassNumber)}
                className="w-16 rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-xs text-neutral-100 focus:border-violet-500 focus:outline-none"
              />
            </label>
          )}

          <label className="flex items-center gap-1.5 text-xs text-neutral-400">
            Date
            <input
              type="date"
              value={dateValue}
              onChange={(e) => setDateValue(e.target.value)}
              className="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-xs text-neutral-100 focus:border-violet-500 focus:outline-none"
            />
          </label>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400">
          <span className="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 font-medium">
            {TYPE_OPTIONS.find((opt) => opt.value === entryType)?.label ?? entryType}
          </span>
          {entryType === 'CLASS' && classNumber && <span>Class #{classNumber}</span>}
          <span>{dateValue}</span>
        </div>
      )}

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Notes</span>
          {isEditing && (
            <button
              type="button"
              onClick={() => setIsToolsPanelOpen((prev) => !prev)}
              aria-pressed={isToolsPanelOpen}
              className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                isToolsPanelOpen
                  ? 'bg-violet-600 text-white'
                  : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
              }`}
            >
              <TableIcon className="h-3.5 w-3.5" />
              Tables &amp; Symbols
            </button>
          )}
        </div>

        {isEditing ? (
          <div className={`grid gap-3 ${isToolsPanelOpen ? 'md:grid-cols-[1fr_18rem]' : 'grid-cols-1'}`}>
            <textarea
              ref={textareaRef}
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="Write your notes here..."
              rows={5}
              className="w-full resize-y rounded-lg border border-neutral-800 bg-neutral-900 p-3 text-sm text-neutral-100 placeholder-neutral-600 focus:border-violet-500 focus:outline-none"
            />

            {isToolsPanelOpen && (
              <div className="h-64 md:h-auto">
                <NotebookToolsPanel
                  onInsert={insertAtCursor}
                  onAddTable={handleAddTable}
                  onClose={() => setIsToolsPanelOpen(false)}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="whitespace-pre-wrap rounded-lg border border-neutral-800 bg-neutral-900 p-3 text-sm text-neutral-200">
            {textContent || <span className="text-neutral-600">No notes.</span>}
          </div>
        )}

        {tables.length > 0 && (
          <div className="mt-3 space-y-3">
            {tables.map((table) => (
              <NotebookTableEditor
                key={table.id}
                table={table}
                readOnly={!isEditing}
                onChange={(next) => setTables((prev) => prev.map((t) => (t.id === next.id ? next : t)))}
                onDelete={() => setTables((prev) => prev.filter((t) => t.id !== table.id))}
              />
            ))}
          </div>
        )}
      </div>

      <NotebookCanvas canvas={canvas} shapes={shapeLayer} links={linkLayer} texts={textLayer} readOnly={!isEditing} />

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Photos
          </span>
          {isEditing && (
            <label className="flex cursor-pointer items-center gap-1.5 rounded-md bg-neutral-800 px-2.5 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-700">
              <ImageIcon className="h-4 w-4" />
              Add photo
              <input
                type="file"
                accept={ACCEPTED_PHOTO_TYPES.join(',')}
                onChange={handlePhotoChange}
                className="hidden"
              />
            </label>
          )}
        </div>

        {photoError && <p className="mb-2 text-xs text-red-400">{photoError}</p>}

        {entry.photos.length > 0 && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {entry.photos.map((photo) => (
              <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-lg bg-neutral-900">
                {photo.url ? (
                  <img src={photo.url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-neutral-600">
                    <ImageIcon className="h-6 w-6" />
                  </div>
                )}
                {isEditing && (
                  <button
                    type="button"
                    onClick={() => onDeletePhoto(photo.id)}
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label="Remove photo"
                  >
                    <XIcon className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {isEditing && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            <CheckIcon className="h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save entry'}
          </button>
        </div>
      )}
      </div>

      {isConfirmingDelete && (
        <DeleteEntryModal
          isDeleting={isDeleting}
          onCancel={() => setIsConfirmingDelete(false)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </>
  );
}
