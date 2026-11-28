import { useCallback, useState } from 'react';
import EmptyState from '../UI/EmptyState';
import LinesSkeleton from '../UI/LinesSkeleton';
import IconButton from '../UI/IconButton';
import { FileIcon, PencilIcon, TrashIcon, UploadIcon } from '../UI/Icons';
import InlineRenameForm from '../UI/InlineRenameForm';
import ConfirmActionDialog from '../Turma/ConfirmActionDialog';
import AttachmentActions from '../Notebook/entry/AttachmentActions';
import AttachmentPreviewModal from '../Notebook/entry/AttachmentPreviewModal';
import type { PreviewableFile } from '../Notebook/entry/attachmentPreview';
import {
  ACCEPTED_ATTACHMENT_EXTENSIONS,
  formatFileSize,
  validateAttachment,
} from '../Notebook/entry/notebookEntryConfig';
import {
  deleteTaskAttachment,
  getTaskAttachments,
  renameTaskAttachment,
  uploadTaskAttachment,
} from '../../api/taskAttachmentsService';
import { useLoadOnce } from '../../hooks/useLoadOnce';
import { useFileUpload } from '../../hooks/useFileUpload';
import { useConfirmAction } from '../../hooks/useConfirmAction';
import { useFeedback } from '../../context/useFeedback';
import { useI18n } from '../../i18n/useI18n';
import { getApiMessage } from '../../lib/httpError';

// Igual a ATTACHMENT_NAME_MAX_LENGTH no backend.
const NAME_MAX_LENGTH = 200;

// Nome sem a extensao, que o backend volta a por.
const baseName = (name: string, extension: string) =>
  name.toLowerCase().endsWith(`.${extension}`) ? name.slice(0, -(extension.length + 1)) : name;

interface TaskAttachmentsSectionProps {
  taskId: string;
}

// Ficheiros da task (ex: enunciado em PDF). Mesmos tipos, limite (10) e
// preview dos anexos do caderno; o backend valida tudo de novo.
export default function TaskAttachmentsSection({ taskId }: TaskAttachmentsSectionProps) {
  const { t } = useI18n();
  const { notify } = useFeedback();
  const [isUploading, setIsUploading] = useState(false);
  const fetcher = useCallback(() => getTaskAttachments(taskId), [taskId]);
  const { data, isLoading, error, reload } = useLoadOnce(fetcher);
  const [previewing, setPreviewing] = useState<PreviewableFile | null>(null);
  const confirm = useConfirmAction(t('taskFiles.actionError'));
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const rename = async (attachmentId: string, name: string) => {
    try {
      await renameTaskAttachment(taskId, attachmentId, name);
    } catch (caught) {
      notify(getApiMessage(caught, t('taskFiles.actionError')), 'error');
      throw caught;
    }
    setRenamingId(null);
    reload();
    notify(t('ux4global.file.renamed'), 'success');
  };
  const files = data ?? [];
  const upload = useFileUpload({
    validate: (file) => validateAttachment(file, files.length),
    onUpload: async (file) => {
      setIsUploading(true);
      try {
        await uploadTaskAttachment(taskId, file);
        reload();
        notify(t('quickWins.fileAdded'), 'success');
      } finally {
        setIsUploading(false);
      }
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
              {renamingId === file.id ? (
                <InlineRenameForm
                  initial={baseName(file.originalFileName, file.extension)}
                  label={t('ux4global.file.nameLabel')}
                  maxLength={NAME_MAX_LENGTH}
                  onSave={(name) => rename(file.id, name)}
                  onCancel={() => setRenamingId(null)}
                />
              ) : (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-neutral-200" title={file.originalFileName}>
                    {file.originalFileName}
                  </span>
                  <span className="block text-xs text-neutral-500">{formatFileSize(file.sizeBytes)}</span>
                </span>
                <AttachmentActions attachment={file} onPreview={setPreviewing} />
                <IconButton
                  label={t('ux4global.file.rename', { name: file.originalFileName })}
                  onClick={() => setRenamingId(file.id)}
                >
                  <PencilIcon className="h-3.5 w-3.5" />
                </IconButton>
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
                        notify(t('quickWins.fileRemoved'), 'success');
                      },
                    })
                  }
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </IconButton>
              </>
              )}
            </li>
          ))}
        </ul>
      )}
      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 transition-colors hover:border-violet-600 hover:text-white focus-within:outline focus-within:outline-2 focus-within:outline-violet-400">
        <UploadIcon className="h-4 w-4" />
        {isUploading ? t('quickWins.fileUploading') : t('notebook.files.add')}
        <input
          type="file"
          accept={ACCEPTED_ATTACHMENT_EXTENSIONS.join(',')}
          disabled={isUploading}
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
