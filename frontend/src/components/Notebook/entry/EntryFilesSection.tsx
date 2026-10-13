import type { ChangeEvent, ReactNode } from 'react';
import { FileIcon, ImageIcon } from '../../UI/Icons';
import SectionLabel from '../../UI/SectionLabel';
import { useFileUpload } from '../../../hooks/useFileUpload';
import type { NotebookAttachment, NotebookPhoto } from '../../../types/models';
import EntryListRow from './EntryListRow';
import NotebookPhotoGrid from './NotebookPhotoGrid';
import {
  ACCEPTED_ATTACHMENT_EXTENSIONS,
  ACCEPTED_PHOTO_TYPES,
  formatFileSize,
  validateAttachment,
  validatePhoto,
} from './notebookEntryConfig';

interface FileSectionShellProps {
  label: string;
  addLabel: string;
  addIcon: ReactNode;
  accept: string;
  isEditing: boolean;
  error: string;
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  children: ReactNode;
}

// Cabecalho (titulo + "Add ...") e erro comuns a anexos e fotos.
function FileSectionShell({ label, addLabel, addIcon, accept, isEditing, error, onFileChange, children }: FileSectionShellProps) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <SectionLabel>{label}</SectionLabel>
        {isEditing && (
          <label className="flex cursor-pointer items-center gap-1.5 rounded-md bg-neutral-800 px-2.5 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-700">
            {addIcon}
            {addLabel}
            <input type="file" accept={accept} onChange={onFileChange} className="hidden" />
          </label>
        )}
      </div>
      {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
      {children}
    </div>
  );
}

interface AttachmentsSectionProps {
  isEditing: boolean;
  attachments: NotebookAttachment[];
  onUpload: (file: File) => Promise<void>;
  onDelete: (attachmentId: string) => Promise<void>;
}

export function AttachmentsSection({ isEditing, attachments, onUpload, onDelete }: AttachmentsSectionProps) {
  const { error, handleChange } = useFileUpload({
    validate: (file) => validateAttachment(file, attachments.length),
    onUpload,
    failureMessage: 'Could not upload the file. Please try again.',
  });

  return (
    <FileSectionShell
      label="Attachments"
      addLabel="Add file"
      addIcon={<FileIcon className="h-4 w-4" />}
      accept={ACCEPTED_ATTACHMENT_EXTENSIONS.join(',')}
      isEditing={isEditing}
      error={error}
      onFileChange={handleChange}
    >
      {attachments.length === 0 ? (
        !isEditing && <p className="text-xs text-neutral-600">No files yet.</p>
      ) : (
        <div className="space-y-1.5">
          {attachments.map((attachment) => (
            <EntryListRow
              key={attachment.id}
              icon={<FileIcon className="h-3.5 w-3.5" />}
              trailing={<span className="shrink-0 text-xs text-neutral-600">{formatFileSize(attachment.sizeBytes)}</span>}
              removeLabel={isEditing ? 'Remove file' : undefined}
              onRemove={isEditing ? () => void onDelete(attachment.id) : undefined}
            >
              {attachment.url ? (
                <a href={attachment.url} className="truncate text-sm text-violet-400 hover:underline" title={attachment.originalFileName}>
                  {attachment.originalFileName}
                </a>
              ) : (
                <span className="truncate text-sm text-neutral-400">{attachment.originalFileName}</span>
              )}
            </EntryListRow>
          ))}
        </div>
      )}
    </FileSectionShell>
  );
}

interface PhotosSectionProps {
  isEditing: boolean;
  photos: NotebookPhoto[];
  onUpload: (file: File) => Promise<void>;
  onDelete: (photoId: string) => Promise<void>;
}

export function PhotosSection({ isEditing, photos, onUpload, onDelete }: PhotosSectionProps) {
  const { error, handleChange } = useFileUpload({
    validate: validatePhoto,
    onUpload,
    failureMessage: 'Could not upload the photo. Please try again.',
  });

  return (
    <FileSectionShell
      label="Photos"
      addLabel="Add photo"
      addIcon={<ImageIcon className="h-4 w-4" />}
      accept={ACCEPTED_PHOTO_TYPES.join(',')}
      isEditing={isEditing}
      error={error}
      onFileChange={handleChange}
    >
      <NotebookPhotoGrid photos={photos} onRemove={isEditing ? (photoId) => void onDelete(photoId) : undefined} />
    </FileSectionShell>
  );
}
