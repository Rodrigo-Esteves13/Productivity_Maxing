import { useCallback } from 'react';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import Card from '../components/UI/Card';
import EmptyState from '../components/UI/EmptyState';
import ErrorState from '../components/UI/ErrorState';
import CardGridSkeleton from '../components/UI/CardGridSkeleton';
import PersonalNoteForm from '../components/PersonalNotes/PersonalNoteForm';
import PersonalNoteItem from '../components/PersonalNotes/PersonalNoteItem';
import MedicationPushWarning from '../components/Wellbeing/MedicationPushWarning';
import ConfirmActionDialog from '../components/Turma/ConfirmActionDialog';
import { useConfirmAction } from '../hooks/useConfirmAction';
import type { PersonalNote } from '../types/models';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { usePersonalNotes } from '../hooks/usePersonalNotes';
import { useI18n } from '../i18n/useI18n';

// Notas pessoais soltas (fora das cadeiras do Notebook) e lembretes para
// o proprio: com hora marcada, chega um aviso push a essa hora.
export default function PersonalNotes() {
  const { t } = useI18n();
  useDocumentTitle(t('notes.title'));
  const { notes, isLoading, error, create, update, remove } = usePersonalNotes();
  const hasReminders = notes.some((n) => n.remindAt && !n.doneAt);
  const confirm = useConfirmAction(t('notes.saveError'));
  const { request } = confirm;

  const requestRemove = useCallback(
    (note: PersonalNote) =>
      request({
        title: t('notes.delete'),
        message: t('notes.deleteConfirm', { title: note.title }),
        confirmLabel: t('common.delete'),
        tone: 'danger',
        run: async () => {
          await remove(note.id);
        },
      }),
    [request, remove, t],
  );

  return (
    <PageLayout>
      <PageHeader title={t('notes.title')} description={t('notes.description')} />
      <Card className="mb-6">
        <PersonalNoteForm onSubmit={create} />
      </Card>
      {/* Mesmo aviso dos lembretes de medicacao: sem push nao chega nada. */}
      <MedicationPushWarning hasReminders={hasReminders} />
      {isLoading ? (
        <CardGridSkeleton cards={3} />
      ) : error ? (
        <ErrorState message={t('notes.loadError')} />
      ) : notes.length === 0 ? (
        <EmptyState message={t('notes.empty')} />
      ) : (
        <ul className="space-y-3">
          {notes.map((note) => (
            <PersonalNoteItem key={note.id} note={note} onUpdate={update} onRemove={requestRemove} />
          ))}
        </ul>
      )}
      <ConfirmActionDialog state={confirm} />
    </PageLayout>
  );
}
