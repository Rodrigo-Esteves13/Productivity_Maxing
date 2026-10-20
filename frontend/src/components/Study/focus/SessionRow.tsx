import { useState } from 'react';
import { PencilIcon, TrashIcon } from '../../UI/Icons';
import IconButton from '../../UI/IconButton';
import InlineConfirm from '../../UI/InlineConfirm';
import { formatDuration } from '../../../lib/timeFormat';
import { toLocalParts } from '../../../lib/sessionWindow';
import type { StudySession } from '../../../types/models';
import SessionForm, { type SessionFormValues } from './SessionForm';
import RatingInput from '../../UI/RatingInput';
import { useI18n } from '../../../i18n/useI18n';

interface SessionRowProps {
  session: StudySession;
  isSaving: boolean;
  serverError: string;
  onEdit: (id: string, values: SessionFormValues) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onRateFocus: (id: string, rating: number) => Promise<boolean>;
}

type RowMode = 'view' | 'edit' | 'confirm-delete';

// O pedido de nota de foco so aparece em sessoes recentes: dias depois ja
// ninguem se lembra, e repetido em cada linha antiga so enchia a lista.
// (Continua disponivel no Editar.)
const RATE_PROMPT_WINDOW_MS = 24 * 60 * 60 * 1000;

export default function SessionRow({ session, isSaving, serverError, onEdit, onDelete, onRateFocus }: SessionRowProps) {
  const { t } = useI18n();
  const [mode, setMode] = useState<RowMode>('view');

  if (mode === 'edit') {
    return (
      <li className="py-2">
        <SessionForm
          session={session}
          isSaving={isSaving}
          serverError={serverError}
          onCancel={() => setMode('view')}
          onSubmit={async (values) => {
            if (await onEdit(session.id, values)) setMode('view');
          }}
        />
      </li>
    );
  }

  const start = toLocalParts(session.startedAt).time;
  const end = session.endedAt ? toLocalParts(session.endedAt).time : '';
  const minutes = Math.round((session.durationSeconds ?? 0) / 60);
  const title = session.task?.title ?? session.area?.name ?? t('ui.studySession');
  const canRateInline =
    session.endedAt !== null &&
    session.focusRating === null &&
    Date.now() - new Date(session.endedAt).getTime() < RATE_PROMPT_WINDOW_MS;

  return (
    <li className="py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">{title}</p>
          <p className="text-xs text-neutral-400">
            {start}-{end} · {formatDuration(minutes)}
            {session.focusRating !== null && <span className="ml-2 text-violet-300">{t('ui.focus5', { focusRating: session.focusRating })}</span>}
            {session.isManual && <span className="ml-2 text-neutral-500">{t('ui.addedByHand')}</span>}
          </p>
          {session.note && <p className="mt-1 break-words text-xs text-neutral-500">{session.note}</p>}
        </div>
        <div className="flex shrink-0 gap-1">
          <IconButton label={t('ui.editSession')} onClick={() => setMode('edit')}>
            <PencilIcon />
          </IconButton>
          <IconButton label={t('ui.deleteSession')} tone="danger" onClick={() => setMode('confirm-delete')}>
            <TrashIcon />
          </IconButton>
        </div>
      </div>
      {canRateInline && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-xs text-neutral-500">{t('rateFocus.rowLabel')}</span>
          <RatingInput value={null} onChange={(value) => value !== null && void onRateFocus(session.id, value)} />
        </div>
      )}
      {mode === 'confirm-delete' && (
        <InlineConfirm
          className="mt-2"
          message={t('ui.deleteThisSessionItsTime')}
          confirmLabel={t('ui.yesDelete')}
          isBusy={isSaving}
          onConfirm={() => void onDelete(session.id)}
          onCancel={() => setMode('view')}
        />
      )}
    </li>
  );
}
