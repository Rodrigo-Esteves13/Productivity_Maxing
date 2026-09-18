import { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { NotebookEntry } from '../../types/models';
import { useDrawingCanvas } from '../../hooks/useDrawingCanvas';
import NotebookCanvas from './NotebookCanvas';
import { TrashIcon, ImageIcon, XIcon, CheckIcon } from '../UI/Icons';

interface NotebookEntryEditorProps {
  entry: NotebookEntry;
  onSave: (payload: { title: string; textContent: string; drawingStrokes: ReturnType<typeof useDrawingCanvas>['strokes'] }) => Promise<void>;
  onDelete: () => Promise<void>;
  onUploadPhoto: (file: File) => Promise<void>;
  onDeletePhoto: (photoId: string) => Promise<void>;
}

const MAX_PHOTO_SIZE = 8 * 1024 * 1024;
const ACCEPTED_PHOTO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export default function NotebookEntryEditor({
  entry,
  onSave,
  onDelete,
  onUploadPhoto,
  onDeletePhoto,
}: NotebookEntryEditorProps) {
  const [title, setTitle] = useState(entry.title);
  const [textContent, setTextContent] = useState(entry.textContent ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const canvas = useDrawingCanvas(entry.drawingStrokes ?? []);

  // Trocar de entrada (outro item da lista) tem de repor o editor inteiro -
  // sem isto o título/texto/traços da entrada anterior "vazavam" para a
  // seguinte até o utilizador tocar em cada campo.
  useEffect(() => {
    setTitle(entry.title);
    setTextContent(entry.textContent ?? '');
  }, [entry.id, entry.title, entry.textContent]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({ title, textContent, drawingStrokes: canvas.strokes });
    } finally {
      setIsSaving(false);
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
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Entry title"
          className="w-full bg-transparent text-lg font-semibold text-white placeholder-neutral-600 focus:outline-none"
        />
        <button
          type="button"
          onClick={onDelete}
          className="shrink-0 rounded-md p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-red-400"
          aria-label="Delete entry"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>

      <textarea
        value={textContent}
        onChange={(e) => setTextContent(e.target.value)}
        placeholder="Write your notes here..."
        rows={5}
        className="w-full resize-y rounded-lg border border-neutral-800 bg-neutral-900 p-3 text-sm text-neutral-100 placeholder-neutral-600 focus:border-violet-500 focus:outline-none"
      />

      <NotebookCanvas canvas={canvas} />

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Photos
          </span>
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
                <button
                  type="button"
                  onClick={() => onDeletePhoto(photo.id)}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="Remove photo"
                >
                  <XIcon className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

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
    </div>
  );
}
