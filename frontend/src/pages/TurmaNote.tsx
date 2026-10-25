import { useNavigate, useParams } from 'react-router-dom';
import PageLayout from '../components/Layout/PageLayout';
import Breadcrumbs from '../components/UI/Breadcrumbs';
import ErrorState from '../components/UI/ErrorState';
import DocumentSkeleton from '../components/UI/DocumentSkeleton';
import Button from '../components/UI/Button';
import SaveStatusText from '../components/Collab/SaveStatusText';
import VersionConflictBanner from '../components/Collab/VersionConflictBanner';
import ConfirmActionDialog from '../components/Turma/ConfirmActionDialog';
import { TURMA_NOTE_MAX_CONTENT_LENGTH, TURMA_NOTE_TITLE_MAX_LENGTH } from '../components/Turma/turmaConfig';
import { deleteTurmaNote } from '../api/turmasService';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useTurmaDetail, useTurmaNote } from '../hooks/useTurmas';
import { useConfirmAction } from '../hooks/useConfirmAction';
import { useI18n } from '../i18n/useI18n';
import { TURMAS_PATH, turmaPath } from '../lib/appLinks';

// Nota da turma: titulo e texto que gravam sozinhos, com aviso de conflito
// quando outro membro grava ao mesmo tempo. Sem permissao, so leitura.
export default function TurmaNote() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { turmaId = '', noteId = '' } = useParams<{ turmaId: string; noteId: string }>();
  const { data: turma, reload: reloadTurma } = useTurmaDetail(turmaId);
  const note = useTurmaNote(turmaId, noteId, t('turma.notes.untitled'), reloadTurma);
  const confirm = useConfirmAction(t('turma.actionError'));
  const canEdit = turma?.canEditNotes ?? false;
  useDocumentTitle(note.doc?.title || t('turma.tab.notes'));

  const notesTab = `${turmaPath(turmaId)}?tab=notes`;
  const requestDelete = () =>
    confirm.request({
      title: t('turma.notes.delete'),
      message: t('turma.notes.deleteConfirm'),
      confirmLabel: t('common.delete'),
      tone: 'danger',
      run: async () => {
        await deleteTurmaNote(turmaId, noteId);
        navigate(notesTab);
      },
    });
  const doc = note.doc;

  return (
    <PageLayout>
      <Breadcrumbs
        items={[
          { label: t('nav.turmas'), to: TURMAS_PATH },
          { label: turma?.name ?? '', to: turmaPath(turmaId) },
          { label: t('turma.tab.notes'), to: notesTab },
          { label: doc?.title ?? '' },
        ]}
      />
      {doc === null ? (
        note.status === 'error' ? <ErrorState message={t('turma.notes.notFound')} /> : <DocumentSkeleton />
      ) : (
        <section className="mx-auto max-w-4xl">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            {canEdit ? <SaveStatusText status={note.status} /> : <span className="text-xs text-neutral-500">{t('turma.notes.readOnly')}</span>}
            {canEdit && (
              <Button variant="secondary" className="px-2.5 py-1 text-xs" onClick={requestDelete}>
                {t('turma.notes.delete')}
              </Button>
            )}
          </div>
          {note.status === 'conflict' && <VersionConflictBanner onTakeRemote={note.takeRemote} onKeepMine={note.keepMine} />}
          <input
            value={doc.title}
            onChange={(e) => note.change({ ...doc, title: e.target.value })}
            readOnly={!canEdit}
            maxLength={TURMA_NOTE_TITLE_MAX_LENGTH}
            aria-label={t('turma.notes.titleLabel')}
            placeholder={t('turma.notes.untitled')}
            className="mb-3 w-full bg-transparent text-2xl font-bold text-white placeholder:text-neutral-600 focus:outline-none"
          />
          <textarea
            value={doc.content}
            onChange={(e) => note.change({ ...doc, content: e.target.value })}
            readOnly={!canEdit}
            maxLength={TURMA_NOTE_MAX_CONTENT_LENGTH}
            aria-label={t('turma.notes.contentLabel')}
            placeholder={canEdit ? t('pad.placeholder') : ''}
            className="block min-h-[60vh] w-full resize-y rounded-lg border border-neutral-800 bg-neutral-950 p-4 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-600/50"
          />
        </section>
      )}
      <ConfirmActionDialog state={confirm} />
    </PageLayout>
  );
}
