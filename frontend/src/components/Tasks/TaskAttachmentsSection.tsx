import { useCallback, useState } from 'react';
import EmptyState from '../UI/EmptyState';
import LinesSkeleton from '../UI/LinesSkeleton';
import IconButton from '../UI/IconButton';
import { FileIcon, TrashIcon, UploadIcon } from '../UI/Icons';
import ConfirmActionDialog from '../Turma/ConfirmActionDialog';
import AttachmentActions from '../Notebook/entry/AttachmentActions';
import AttachmentPreviewModal from '../Notebook/entry/AttachmentPreviewModal';
import type { PreviewableFile } from '../Notebook/entry/attachmentPreview';
import {
  ACCEPTED_ATTACHMENT_EXTENSIONS,
  formatFileSize,
  validateAttachment,
} from '../Notebook/entry/notebookEntryConfig';
import { deleteTaskAttachment, getTaskAttachments, uploadTaskAttachment } from '../../api/taskAttachmentsService';
import { useLoadOnce } from '../../hooks/useLoadOnce';
import { useFileUpload } from '../../hooks/useFileUpload';
import { useConfirmAction } from '../../hooks/useConfirmAction';
import { useI18n } from '../../i18n/useI18n';

interface TaskAttachmentsSectionProps {
  taskId: string;
}

// Ficheiros da task (ex: enunciado em PDF). Mesmos tipos, limite (10) e
// preview dos anexos do caderno; o backend valida tudo de novo.
export default function TaskAttachmentsSection({ taskId }: TaskAttachmentsSectionProps) {
  const { t } = useI18n();
  const fetcher = useCallback(() => getTaskAttachments(taskId), [taskId]);
  const { data, isLoading, error, reload } = useLoadOnce(fetcher);
  const [previewing, setPreviewing] = useState<PreviewableFile | null>(null);
  const confirm = useConfirmAction(t('taskFiles.actionError'));
  const files = data ?? [];
  const upload = useFileUpload({
    validate: (file) => validateAttachment(file, files.length),
    onUpload: async (file) => {
      await uploadTaskAttachment(taskId, file);
      reload();
    },
    failureMessage: t('ui.couldNotUploadFile'),
  });

  return (
    <div className="space-y-2">
      {isLoading ? (
        <LinesSkeleton lines={2} />
      ) : error ? (
        <p className="text-sm text-red-400">{t('taskFiles.loadError')}</p>
      ) : files.length === 0 ? (
        <EmptyState variant="inline" message={t('notebook.files.none')} />
      ) : (
        <ul className="space-y-1.5">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900 px-2.5 py-1.5"
            >
              <FileIcon className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-neutral-200" title={file.originalFileName}>
                  {file.originalFileName}
                </span>
                <span className="block text-xs text-neutral-600">{formatFileSize(file.sizeBytes)}</span>
              </span>
              <AttachmentActions attachment={file} onPreview={setPreviewing} />
              <IconButton
                label={t('notebook.files.remove')}
                tone="danger"
                onClick={() =>
                  confirm.request({
                    title: t('notebook.files.remove'),
                    message: t('taskFiles.deleteConfirm', { name: file.originalFileName }),
                    confirmLabel: t('common.delete'),
                    tone: 'danger',
                    run: async () => {
                      await deleteTaskAttachment(taskId, file.id);
                      reload();
                    },
                  })
                }
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 transition-colors hover:border-violet-600 hover:text-white focus-within:outline focus-within:outline-2 focus-within:outline-violet-400">
        <UploadIcon className="h-4 w-4" />
        {t('notebook.files.add')}
        <input
          type="file"
          accept={ACCEPTED_ATTACHMENT_EXTENSIONS.join(',')}
          onChange={(e) => void upload.handleChange(e)}
          className="sr-only"
        />
      </label>
      {upload.error && <p className="text-xs text-red-400">{upload.error}</p>}
      <AttachmentPreviewModal attachment={previewing} onClose={() => setPreviewing(null)} />
      <ConfirmActionDialog state={confirm} />
    </div>
  );
}
