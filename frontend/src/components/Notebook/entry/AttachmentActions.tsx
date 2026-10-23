import { DownloadIcon, EyeIcon } from '../../UI/Icons';
import IconButton from '../../UI/IconButton';
import { useI18n } from '../../../i18n/useI18n';
import { getPreviewKind, type PreviewableFile } from './attachmentPreview';

interface AttachmentActionsProps {
  attachment: PreviewableFile;
  onPreview: (attachment: PreviewableFile) => void;
}

const ICON_LINK_CLASS =
  'inline-flex items-center justify-center rounded-md p-1.5 text-neutral-500 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400';

// Olho (preview na app, so para tipos com preview) e seta (transferir) de um
// anexo. Usado no editor do caderno e na nota partilhada.
export default function AttachmentActions({ attachment, onPreview }: AttachmentActionsProps) {
  const { t } = useI18n();
  if (!attachment.url) return null;

  return (
    <span className="flex shrink-0 items-center">
      {getPreviewKind(attachment.extension) && (
        <IconButton label={t('notebook.files.preview')} onClick={() => onPreview(attachment)}>
          <EyeIcon className="h-3.5 w-3.5" />
        </IconButton>
      )}
      <a
        href={attachment.url}
        aria-label={t('notebook.files.download')}
        title={t('notebook.files.download')}
        className={ICON_LINK_CLASS}
      >
        <DownloadIcon className="h-3.5 w-3.5" />
      </a>
    </span>
  );
}
