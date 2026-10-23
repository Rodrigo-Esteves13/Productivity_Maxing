import { useEffect, useState } from 'react';
import { fetchAttachmentContent } from '../api/notebookService';
import {
  PDF_MIME_TYPE,
  TEXT_PREVIEW_MAX_CHARS,
  getPreviewKind,
  type AttachmentPreviewKind,
  type PreviewableFile,
} from '../components/Notebook/entry/attachmentPreview';

export type AttachmentPreviewState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'unsupported' }
  | { status: 'ready'; kind: Extract<AttachmentPreviewKind, 'pdf'>; objectUrl: string }
  | { status: 'ready'; kind: Extract<AttachmentPreviewKind, 'text'>; text: string; truncated: boolean };

type ReadyState = Extract<AttachmentPreviewState, { status: 'ready' }>;

const LOADERS: Record<AttachmentPreviewKind, (blob: Blob) => Promise<ReadyState>> = {
  pdf: async (blob) => ({
    status: 'ready',
    kind: 'pdf',
    objectUrl: URL.createObjectURL(new Blob([blob], { type: PDF_MIME_TYPE })),
  }),
  text: async (blob) => {
    const text = await blob.text();
    return {
      status: 'ready',
      kind: 'text',
      text: text.slice(0, TEXT_PREVIEW_MAX_CHARS),
      truncated: text.length > TEXT_PREVIEW_MAX_CHARS,
    };
  },
};

// Descarrega o anexo aberto no preview e prepara-o para mostrar. Liberta o
// blob: URL do PDF quando o preview fecha ou muda de ficheiro.
export function useAttachmentPreview(attachment: PreviewableFile | null): AttachmentPreviewState {
  const [state, setState] = useState<AttachmentPreviewState>({ status: 'idle' });
  const url = attachment?.url ?? null;
  const kind = attachment ? getPreviewKind(attachment.extension) : null;

  useEffect(() => {
    if (!attachment) {
      setState({ status: 'idle' });
      return;
    }
    if (!kind || !url) {
      setState({ status: 'unsupported' });
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    setState({ status: 'loading' });
    fetchAttachmentContent(url)
      .then((blob) => LOADERS[kind](blob))
      .then((ready) => {
        if (ready.kind === 'pdf') objectUrl = ready.objectUrl;
        if (cancelled) {
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          return;
        }
        setState(ready);
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' });
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment, kind, url]);

  return state;
}
