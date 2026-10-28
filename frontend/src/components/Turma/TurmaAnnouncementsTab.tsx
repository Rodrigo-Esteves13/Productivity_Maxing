import { useEffect, useState, type FormEvent } from 'react';
import Button from '../UI/Button';
import Input from '../UI/Input';
import Textarea from '../UI/Textarea';
import FormError from '../UI/FormError';
import EmptyState from '../UI/EmptyState';
import ErrorState from '../UI/ErrorState';
import LinesSkeleton from '../UI/LinesSkeleton';
import IconButton from '../UI/IconButton';
import { TrashIcon } from '../UI/Icons';
import ConfirmActionDialog from './ConfirmActionDialog';
import { createAnnouncement, deleteAnnouncement } from '../../api/turmasService';
import { useTurmaAction, useTurmaAnnouncements } from '../../hooks/useTurmas';
import { useConfirmAction } from '../../hooks/useConfirmAction';
import { useI18n } from '../../i18n/useI18n';
import { formatDateTime } from '../../lib/timeFormat';
import { markAnnouncementsSeen } from '../../lib/turmaSeen';
import { ANNOUNCEMENT_BODY_MAX_LENGTH, ANNOUNCEMENT_TITLE_MAX_LENGTH } from './turmaConfig';

interface TurmaTabProps {
  turmaId: string;
  isDelegado: boolean;
}

// Avisos do delegado (testes, prazos, mudancas). Os membros so leem.
export default function TurmaAnnouncementsTab({ turmaId, isDelegado }: TurmaTabProps) {
  const { t } = useI18n();
  const { data, isLoading, error, reload } = useTurmaAnnouncements(turmaId);
  const confirm = useConfirmAction(t('turma.actionError'));

  // Abrir os avisos conta como "visto" (tira o "novo aviso" da lista).
  useEffect(() => {
    if (data) markAnnouncementsSeen(turmaId);
  }, [data, turmaId]);

  return (
    <div className="space-y-4">
      {isDelegado && <NewAnnouncementForm turmaId={turmaId} onPosted={reload} />}
      {isLoading ? (
        <LinesSkeleton lines={4} />
      ) : error ? (
        <ErrorState message={t('turma.loadError')} />
      ) : !data || data.length === 0 ? (
        <EmptyState message={t('turma.announcements.none')} />
      ) : (
        <ul className="space-y-3">
          {data.map((announcement) => (
            <li key={announcement.id} className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
              <div className="mb-1 flex items-start justify-between gap-2">
                <h3 className="font-semibold text-white">{announcement.title}</h3>
                {isDelegado && (
                  <IconButton
                    label={t('turma.announcements.delete')}
                    tone="danger"
                    onClick={() =>
                      confirm.request({
                        title: t('turma.announcements.delete'),
                        message: t('turma.announcements.deleteConfirm'),
                        confirmLabel: t('common.delete'),
                        tone: 'danger',
                        run: async () => {
                          await deleteAnnouncement(turmaId, announcement.id);
                          reload();
                        },
                      })
                    }
                  >
                    <TrashIcon className="h-4 w-4" />
                  </IconButton>
                )}
              </div>
              <p className="whitespace-pre-wrap break-words text-sm text-neutral-300">{announcement.body}</p>
              <p className="mt-2 text-xs text-neutral-500">
                {announcement.authorName ?? t('social.anonymous')} · {formatDateTime(announcement.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
      <ConfirmActionDialog state={confirm} />
    </div>
  );
}

function NewAnnouncementForm({ turmaId, onPosted }: { turmaId: string; onPosted: () => void }) {
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const post = useTurmaAction(createAnnouncement, t('turma.actionError'));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await post.execute(turmaId, { title: title.trim(), body: body.trim() });
    if (ok === null) return;
    setTitle('');
    setBody('');
    onPosted();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-900/30 p-4">
      <Input
        label={t('turma.announcements.titleLabel')}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={ANNOUNCEMENT_TITLE_MAX_LENGTH}
      />
      <Textarea
        label={t('turma.announcements.bodyLabel')}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={ANNOUNCEMENT_BODY_MAX_LENGTH}
        rows={3}
      />
      <p className="text-xs text-neutral-500">{t('turma.announcements.pushHint')}</p>
      {post.error && <FormError message={post.error} />}
      <Button type="submit" disabled={post.isBusy || !title.trim() || !body.trim()}>
        {t('turma.announcements.post')}
      </Button>
    </form>
  );
}
