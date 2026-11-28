import { useState } from 'react';
import { useI18n } from '../../../i18n/useI18n';
import { useDrawingCanvas } from '../../../hooks/useDrawingCanvas';
import { useCanvasShapes } from '../../../hooks/useCanvasShapes';
import { useCanvasLinks } from '../../../hooks/useCanvasLinks';
import { useCanvasTexts } from '../../../hooks/useCanvasTexts';
import Button from '../../UI/Button';
import { LinkIcon, FileIcon, PencilIcon } from '../../UI/Icons';
import NotebookCanvas from '../NotebookCanvas';
import NotebookTableEditor from '../NotebookTableEditor';
import SharedEntryEditForm from '../SharedEntryEditForm';
import NotebookPhotoGrid from '../entry/NotebookPhotoGrid';
import AttachmentActions from '../entry/AttachmentActions';
import AttachmentPreviewModal from '../entry/AttachmentPreviewModal';
import EntrySheet from '../entry/EntrySheet';
import EntrySectionHeader from '../entry/EntrySectionHeader';
import type { PreviewableFile } from '../entry/attachmentPreview';
import type { SharedNotebookEntry, SharedRole } from '../../../types/models';

const noop = () => {};

// À parte de propósito: useDrawingCanvas/useCanvasShapes/useCanvasLinks/
// useCanvasTexts só aplicam o valor inicial no primeiro render (são
// useState por baixo, ver comentário "trocar de entrada" em
// NotebookEntryEditor.tsx) - se estes hooks corressem no componente de
// cima, chamados sempre com `entry?.x ?? []` enquanto `entry` ainda era
// null, o canvas ficava preso a vazio mesmo depois dos dados chegarem.
// Este componente só monta quando `entry` já existe, por isso o valor
// inicial que os hooks veem já é o correto.
export default function SharedNotebookEntryView({
  entry,
  token,
  role,
  hasPendingProposal,
  onChanged,
}: {
  entry: SharedNotebookEntry;
  token: string;
  role: SharedRole;
  hasPendingProposal: boolean;
  onChanged: () => void;
}) {
  const { t, lang } = useI18n();
  const [isEditing, setIsEditing] = useState(false);
  const [justProposed, setJustProposed] = useState(false);
  const [previewing, setPreviewing] = useState<PreviewableFile | null>(null);
  // O dono edita no proprio Notebook; aqui so editor e co-owner editam.
  const canEdit = role === 'EDITOR' || role === 'CO_OWNER';
  const isProposal = role === 'EDITOR';
  const bannerKey =
    role === 'CO_OWNER' ? 'sharedEdit.banner.coOwner' : role === 'EDITOR' ? 'sharedEdit.banner.editor' : null;
  const canvas = useDrawingCanvas(entry.drawingStrokes ?? []);
  const shapeLayer = useCanvasShapes(entry.canvasShapes ?? []);
  const linkLayer = useCanvasLinks(entry.canvasLinks ?? []);
  const textLayer = useCanvasTexts(entry.canvasTexts ?? []);

  const hasCanvas =
    (entry.drawingStrokes?.length ?? 0) > 0 ||
    (entry.canvasShapes?.length ?? 0) > 0 ||
    (entry.canvasTexts?.length ?? 0) > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
        <div className="rounded-md border border-violet-900/50 bg-violet-950/30 px-3 py-1.5 text-center text-xs text-violet-300">
          {bannerKey ? t(bannerKey) : t('ui.sharedReadOnlyViewProductivity')}
        </div>

        {isProposal && (hasPendingProposal || justProposed) && (
          <p role="status" className="rounded-md border border-amber-900/40 bg-amber-950/20 px-3 py-1.5 text-center text-xs text-amber-300">
            {t('sharedEdit.pending')}
          </p>
        )}

        {canEdit && !isEditing && (
          <div className="flex justify-end">
            <Button
              type="button"
              variant="secondary"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
              onClick={() => setIsEditing(true)}
            >
              <PencilIcon className="h-3.5 w-3.5" />
              {isProposal ? t('sharedEdit.suggest') : t('sharedEdit.edit')}
            </Button>
          </div>
        )}

        <EntrySheet toolbar={null}>
        {canEdit && isEditing ? (
          <SharedEntryEditForm
            token={token}
            isProposal={isProposal}
            initialTitle={entry.title}
            initialText={entry.textContent ?? ''}
            baseUpdatedAt={entry.updatedAt}
            onCancel={() => setIsEditing(false)}
            onDone={(applied) => {
              setIsEditing(false);
              if (applied) onChanged();
              else setJustProposed(true);
            }}
          />
        ) : (
        <>
        <div className="space-y-1">
          <span
            className="inline-block rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{
              backgroundColor: `${entry.area.colorHex}22`,
              // Mesmo truque do PriorityBadge: a cor da area sozinha pode nao ler bem.
              color: `color-mix(in oklab, ${entry.area.colorHex} 50%, var(--color-neutral-100))`,
            }}
          >
            {entry.area.name}
          </span>
          <h1 className="break-words font-serif text-2xl font-semibold leading-tight text-white sm:text-3xl">{entry.title}</h1>
          <p className="text-xs text-neutral-500">{new Date(entry.date).toLocaleDateString(lang)}</p>
        </div>

        {entry.textContent && (
          <section>
            <EntrySectionHeader icon={PencilIcon} title={t('notebook.section.notes')} />
            <div className="notebook-ruled max-w-prose whitespace-pre-wrap break-words font-serif text-base text-neutral-100">
              {entry.textContent}
            </div>
          </section>
        )}
        </>
        )}

        {(entry.tables?.length ?? 0) > 0 && (
          <div className="space-y-3">
            {entry.tables!.map((table) => (
              <NotebookTableEditor key={table.id} table={table} readOnly onChange={noop} onDelete={noop} />
            ))}
          </div>
        )}

        {hasCanvas && (
          <NotebookCanvas
            canvas={canvas}
            shapes={shapeLayer}
            links={linkLayer}
            texts={textLayer}
            readOnly
            canvasHeight={entry.canvasHeight ?? undefined}
          />
        )}

        {(entry.usefulLinks?.length ?? 0) > 0 && (
          <section>
            <EntrySectionHeader icon={LinkIcon} title={t('ui.usefulLinks')} />
            <div className="space-y-1.5">
              {entry.usefulLinks!.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-xs text-violet-400 hover:border-violet-700"
                >
                  <LinkIcon className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
                  {link.label}
                </a>
              ))}
            </div>
          </section>
        )}

        <NotebookPhotoGrid photos={entry.photos} className="grid grid-cols-2 gap-2 sm:grid-cols-3" />

        {entry.attachments.length > 0 && (
          <div className="space-y-1.5">
            {entry.attachments.map(
              (attachment) =>
                attachment.url && (
                  <div
                    key={attachment.id}
                    className="flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-xs text-neutral-300"
                  >
                    <FileIcon className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
                    <span className="min-w-0 flex-1 truncate" title={attachment.originalFileName}>
                      {attachment.originalFileName}
                    </span>
                    <AttachmentActions attachment={attachment} onPreview={setPreviewing} />
                  </div>
                ),
            )}
          </div>
        )}
        <AttachmentPreviewModal attachment={previewing} onClose={() => setPreviewing(null)} />
        </EntrySheet>
    </div>
  );
}
