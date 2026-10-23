import Modal from '../../UI/Modal';
import { DownloadIcon } from '../../UI/Icons';
import { useI18n } from '../../../i18n/useI18n';
import { useAttachmentPreview } from '../../../hooks/useAttachmentPreview';
import type { PreviewableFile } from './attachmentPreview';

interface AttachmentPreviewModalProps {
  attachment: PreviewableFile | null;
  onClose: () => void;
}

// Preview de um anexo dentro da app: PDF num iframe (blob:), texto num <pre>.
// O resto mostra so o aviso e o botao de transferir.
export default function AttachmentPreviewModal({ attachment, onClose }: AttachmentPreviewModalProps) {
  const { t } = useI18n();
  const preview = useAttachmentPreview(attachment);

  const downloadAction = attachment?.url && (
    <a
      href={attachment.url}
      className="flex items-center gap-1.5 rounded-md bg-neutral-800 px-2.5 py-1.5 text-xs font-medium text-neutral-200 transition-colors hover:bg-neutral-700"
    >
      <DownloadIcon className="h-3.5 w-3.5" />
      {t('notebook.files.download')}
    </a>
  );

  return (
    <Modal
      isOpen={attachment !== null}
      onClose={onClose}
      title={attachment?.originalFileName ?? ''}
      action={downloadAction}
      size="wide"
    >
      {preview.status === 'loading' && <p className="text-sm text-neutral-500">{t('common.loading')}</p>}
      {preview.status === 'error' && <p className="text-sm text-red-400">{t('notebook.files.previewError')}</p>}
      {preview.status === 'unsupported' && (
        <p className="text-sm text-neutral-400">{t('notebook.files.previewUnsupported')}</p>
      )}
      {preview.status === 'ready' && preview.kind === 'pdf' && (
        <iframe
          src={preview.objectUrl}
          title={attachment?.originalFileName ?? ''}
          className="h-[70vh] w-full rounded-md border border-neutral-800 bg-white"
        />
      )}
      {preview.status === 'ready' && preview.kind === 'text' && (
        <>
          <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap break-words rounded-md border border-neutral-800 bg-neutral-950 p-3 font-mono text-xs text-neutral-200">
            {preview.text}
          </pre>
          {preview.truncated && <p className="mt-2 text-xs text-neutral-500">{t('notebook.files.previewTruncated')}</p>}
        </>
      )}
    </Modal>
  );
}
