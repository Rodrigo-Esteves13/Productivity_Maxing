import { useState } from 'react';
import EmptyState from '../UI/EmptyState';
import ErrorState from '../UI/ErrorState';
import LinesSkeleton from '../UI/LinesSkeleton';
import IconButton from '../UI/IconButton';
import { FileIcon, TrashIcon, UploadIcon } from '../UI/Icons';
import ConfirmActionDialog from './ConfirmActionDialog';
import AttachmentActions from '../Notebook/entry/AttachmentActions';
import AttachmentPreviewModal from '../Notebook/entry/AttachmentPreviewModal';
import type { PreviewableFile } from '../Notebook/entry/attachmentPreview';
import {
  ACCEPTED_ATTACHMENT_EXTENSIONS,
  formatFileSize,
  validateAttachment,
} from '../Notebook/entry/notebookEntryConfig';
import { deleteTurmaFile, uploadTurmaFile } from '../../api/turmasService';
import { useTurmaFiles } from '../../hooks/useTurmas';
import { useFileUpload } from '../../hooks/useFileUpload';
import { useConfirmAction } from '../../hooks/useConfirmAction';
import { useAuth } from '../../context/useAuth';
import { useI18n } from '../../i18n/useI18n';

interface TurmaFilesTabProps {
  turmaId: string;
  isDelegado: boolean;
}

// Pasta partilhada da turma: mesmos tipos e preview dos anexos do caderno.
// Apaga quem enviou ou o delegado.
export default function TurmaFilesTab({ turmaId, isDelegado }: TurmaFilesTabProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const { data, isLoading, error, reload } = useTurmaFiles(turmaId);
  const [previewing, setPreviewing] = useState<PreviewableFile | null>(null);
  const confirm = useConfirmAction(t('turma.actionError'));
  const upload = useFileUpload({
    // Sem limite por entrada aqui: o da turma (300) e o backend que aplica.
    validate: (file) => validateAttachment(file, 0),
    onUpload: async (file) => {
      await uploadTurmaFile(turmaId, file);
      reload();
    },
    failureMessage: t('ui.couldNotUploadFile'),
  });

  return (
    <div className="space-y-3">
      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-violet-700 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-600 focus-within:outline focus-within:outline-2 focus-within:outline-violet-400">
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
      {isLoading ? (
        <LinesSkeleton lines={4} />
      ) : error ? (
        <ErrorState message={t('turma.loadError')} />
      ) : !data || data.length === 0 ? (
        <EmptyState message={t('turma.files.none')} />
      ) : (
        <ul className="space-y-1.5">
          {data.map((file) => (
            <li
              key={file.id}
              className="flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900 px-2.5 py-1.5"
            >
              <FileIcon className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-neutral-200" title={file.originalFileName}>
                  {file.originalFileName}
                </span>
                <span className="block text-xs text-neutral-600">
                  {formatFileSize(file.sizeBytes)} · {file.uploadedByName ?? t('social.anonymous')}
                </span>
              </span>
              <AttachmentActions attachment={file} onPreview={setPreviewing} />
              {(isDelegado || file.uploadedById === user?.id) && (
                <IconButton
                  label={t('notebook.files.remove')}
                  tone="danger"
                  onClick={() =>
                    confirm.request({
                      title: t('notebook.files.remove'),
                      message: t('turma.files.deleteConfirm', { name: file.originalFileName }),
                      confirmLabel: t('common.delete'),
                      tone: 'danger',
                      run: async () => {
                        await deleteTurmaFile(turmaId, file.id);
                        reload();
                      },
                    })
                  }
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </IconButton>
              )}
            </li>
          ))}
        </ul>
      )}
      <AttachmentPreviewModal attachment={previewing} onClose={() => setPreviewing(null)} />
      <ConfirmActionDialog state={confirm} />
    </div>
  );
}
