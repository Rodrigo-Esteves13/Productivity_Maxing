import { useState } from 'react';
import type { ChangeEvent, ComponentType, ReactNode } from 'react';
import { FileIcon, ImageIcon, UploadIcon } from '../../UI/Icons';
import EntrySectionHeader from './EntrySectionHeader';
import { useI18n } from '../../../i18n/useI18n';
import { useFileUpload } from '../../../hooks/useFileUpload';
import type { NotebookAttachment, NotebookPhoto } from '../../../types/models';
import EntryListRow from './EntryListRow';
import NotebookPhotoGrid from './NotebookPhotoGrid';
import AttachmentActions from './AttachmentActions';
import AttachmentPreviewModal from './AttachmentPreviewModal';
import type { PreviewableFile } from './attachmentPreview';
import {
  ACCEPTED_ATTACHMENT_EXTENSIONS,
  ACCEPTED_PHOTO_TYPES,
  formatFileSize,
  validateAttachment,
  validatePhoto,
} from './notebookEntryConfig';

interface FileSectionShellProps {
  icon: ComponentType<{ className?: string }>;
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
function FileSectionShell({ icon, label, addLabel, addIcon, accept, isEditing, error, onFileChange, children }: FileSectionShellProps) {
  return (
    <section>
      <EntrySectionHeader
        icon={icon}
        title={label}
        action={
          isEditing && (
            <label className="flex cursor-pointer items-center gap-1.5 rounded-md bg-neutral-800 px-2.5 py-1.5 text-xs font-medium text-neutral-200 transition-colors hover:bg-neutral-700 focus-within:outline focus-within:outline-2 focus-within:outline-violet-400">
              {addIcon}
              {addLabel}
              <input type="file" accept={accept} onChange={onFileChange} className="sr-only" />
            </label>
          )
        }
      />
      {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
      {children}
    </section>
  );
}

interface AttachmentsSectionProps {
  isEditing: boolean;
  attachments: NotebookAttachment[];
  onUpload: (file: File) => Promise<void>;
  onDelete: (attachmentId: string) => Promise<void>;
}

export function AttachmentsSection({ isEditing, attachments, onUpload, onDelete }: AttachmentsSectionProps) {
  const { t } = useI18n();
  const { error, handleChange } = useFileUpload({
    validate: (file) => validateAttachment(file, attachments.length),
    onUpload,
    failureMessage: t('ui.couldNotUploadFile'),
  });
  const [previewing, setPreviewing] = useState<PreviewableFile | null>(null);

  return (
    <FileSectionShell
      icon={FileIcon}
      label={t('notebook.section.files')}
      addLabel={t('notebook.files.add')}
      addIcon={<UploadIcon className="h-3.5 w-3.5" />}
      accept={ACCEPTED_ATTACHMENT_EXTENSIONS.join(',')}
      isEditing={isEditing}
      error={error}
      onFileChange={handleChange}
    >
      {attachments.length === 0 ? (
        !isEditing && <p className="text-xs text-neutral-600">{t('notebook.files.none')}</p>
      ) : (
        <div className="space-y-1.5">
          {attachments.map((attachment) => (
            <EntryListRow
              key={attachment.id}
              icon={<FileIcon className="h-3.5 w-3.5" />}
              trailing={
                <span className="ml-auto flex shrink-0 items-center gap-1">
                  <span className="text-xs text-neutral-600">{formatFileSize(attachment.sizeBytes)}</span>
                  <AttachmentActions attachment={attachment} onPreview={setPreviewing} />
                </span>
              }
              removeLabel={isEditing ? t('notebook.files.remove') : undefined}
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
      <AttachmentPreviewModal attachment={previewing} onClose={() => setPreviewing(null)} />
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
  const { t } = useI18n();
  const { error, handleChange } = useFileUpload({
    validate: validatePhoto,
    onUpload,
    failureMessage: t('ui.couldNotUploadPhoto'),
  });

  return (
    <FileSectionShell
      icon={ImageIcon}
      label={t('notebook.section.photos')}
      addLabel={t('notebook.photos.add')}
      addIcon={<ImageIcon className="h-3.5 w-3.5" />}
      accept={ACCEPTED_PHOTO_TYPES.join(',')}
      isEditing={isEditing}
      error={error}
      onFileChange={handleChange}
    >
      <NotebookPhotoGrid photos={photos} onRemove={isEditing ? (photoId) => void onDelete(photoId) : undefined} />
    </FileSectionShell>
  );
}
