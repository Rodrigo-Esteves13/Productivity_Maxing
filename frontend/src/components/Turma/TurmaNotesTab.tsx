import { Link, useNavigate } from 'react-router-dom';
import Button from '../UI/Button';
import FormError from '../UI/FormError';
import EmptyState from '../UI/EmptyState';
import ErrorState from '../UI/ErrorState';
import LinesSkeleton from '../UI/LinesSkeleton';
import { PlusIcon } from '../UI/Icons';
import { createTurmaNote } from '../../api/turmasService';
import { useTurmaAction, useTurmaNotes } from '../../hooks/useTurmas';
import { useI18n } from '../../i18n/useI18n';
import { formatDateTime } from '../../lib/timeFormat';
import { turmaNotePath } from '../../lib/appLinks';

interface TurmaNotesTabProps {
  turmaId: string;
  canEdit: boolean;
}

// Notas da turma: qualquer membro le; criar/editar depende da definicao do
// delegado (canEdit).
export default function TurmaNotesTab({ turmaId, canEdit }: TurmaNotesTabProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { data, isLoading, error } = useTurmaNotes(turmaId);
  const create = useTurmaAction(createTurmaNote, t('turma.actionError'));

  const handleCreate = async () => {
    const note = await create.execute(turmaId, t('turma.notes.untitled'));
    if (note) navigate(turmaNotePath(turmaId, note.id));
  };

  return (
    <div className="space-y-3">
      {canEdit ? (
        <Button onClick={() => void handleCreate()} disabled={create.isBusy} className="inline-flex items-center gap-1.5">
          <PlusIcon className="h-4 w-4" />
          {t('turma.notes.new')}
        </Button>
      ) : (
        <p className="text-xs text-neutral-500">{t('turma.notes.readOnly')}</p>
      )}
      {create.error && <FormError message={create.error} />}
      {isLoading ? (
        <LinesSkeleton lines={4} />
      ) : error ? (
        <ErrorState message={t('turma.loadError')} />
      ) : !data || data.length === 0 ? (
        <EmptyState message={t('turma.notes.none')} />
      ) : (
        <ul className="space-y-2">
          {data.map((note) => (
            <li key={note.id}>
              <Link
                to={turmaNotePath(turmaId, note.id)}
                className="flex items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-900/40 p-3 hover:border-neutral-700"
              >
                <span className="min-w-0 truncate text-sm font-medium text-white">{note.title}</span>
                <span className="shrink-0 text-xs text-neutral-500">
                  {note.updatedByName ?? t('social.anonymous')} · {formatDateTime(note.updatedAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
