import { useState } from 'react';
import { PencilIcon, TrashIcon } from '../../UI/Icons';
import IconButton from '../../UI/IconButton';
import InlineConfirm from '../../UI/InlineConfirm';
import { formatDuration } from '../../../lib/timeFormat';
import { toLocalParts } from '../../../lib/sessionWindow';
import type { StudySession } from '../../../types/models';
import SessionForm, { type SessionFormValues } from './SessionForm';

interface SessionRowProps {
  session: StudySession;
  isSaving: boolean;
  serverError: string;
  onEdit: (id: string, values: SessionFormValues) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}

type RowMode = 'view' | 'edit' | 'confirm-delete';

export default function SessionRow({ session, isSaving, serverError, onEdit, onDelete }: SessionRowProps) {
  const [mode, setMode] = useState<RowMode>('view');

  if (mode === 'edit') {
    return (
      <li>
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
  const title = session.task?.title ?? session.area?.name ?? 'Study session';

  return (
    <li className="rounded-lg border border-neutral-800 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">{title}</p>
          <p className="text-xs text-neutral-400">
            {start}-{end} · {formatDuration(minutes)}
            {session.focusRating !== null && <span className="ml-2 text-violet-300">focus {session.focusRating}/5</span>}
            {session.isManual && <span className="ml-2 text-neutral-500">added by hand</span>}
          </p>
          {session.note && <p className="mt-1 break-words text-xs text-neutral-500">{session.note}</p>}
        </div>
        <div className="flex shrink-0 gap-1">
          <IconButton label="Edit session" onClick={() => setMode('edit')}>
            <PencilIcon />
          </IconButton>
          <IconButton label="Delete session" tone="danger" onClick={() => setMode('confirm-delete')}>
            <TrashIcon />
          </IconButton>
        </div>
      </div>
      {mode === 'confirm-delete' && (
        <InlineConfirm
          className="mt-2"
          message="Delete this session? Its time stops counting."
          confirmLabel="Yes, delete"
          isBusy={isSaving}
          onConfirm={() => void onDelete(session.id)}
          onCancel={() => setMode('view')}
        />
      )}
    </li>
  );
}
