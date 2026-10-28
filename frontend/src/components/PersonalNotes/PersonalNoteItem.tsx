import { memo, useState } from 'react';
import IconButton from '../UI/IconButton';
import { TrashIcon } from '../UI/Icons';
import PersonalNoteForm from './PersonalNoteForm';
import { useI18n } from '../../i18n/useI18n';
import { formatDateTime } from '../../lib/timeFormat';
import type { PersonalNoteInput } from '../../api/personalNotesService';
import type { PersonalNote } from '../../types/models';

type ReminderState = 'upcoming' | 'due' | 'sent';

const REMINDER_CLASS: Record<ReminderState, string> = {
  upcoming: 'border-violet-700 text-violet-300',
  due: 'border-amber-600 text-amber-300',
  sent: 'border-neutral-700 text-neutral-400',
};

const REMINDER_KEY: Record<ReminderState, string> = {
  upcoming: 'notes.reminder.upcoming',
  due: 'notes.reminder.due',
  sent: 'notes.reminder.sent',
};

function reminderState(note: PersonalNote, now: number): ReminderState | null {
  if (!note.remindAt || note.doneAt) return null;
  if (note.remindedAt) return 'sent';
  return Date.parse(note.remindAt) <= now ? 'due' : 'upcoming';
}

const LINK_BUTTON = 'text-xs text-violet-300 hover:text-violet-200';

interface PersonalNoteItemProps {
  note: PersonalNote;
  onUpdate: (id: string, input: PersonalNoteInput) => Promise<boolean>;
  // Pede confirmacao antes de apagar (quem chama mostra o dialogo).
  onRemove: (note: PersonalNote) => void;
}

function PersonalNoteItem({ note, onUpdate, onRemove }: PersonalNoteItemProps) {
  const { t } = useI18n();
  const [isEditing, setIsEditing] = useState(false);
  const state = reminderState(note, Date.now());
  const isDone = note.doneAt !== null;

  if (isEditing) {
    return (
      <li className="rounded-xl border border-violet-800 bg-neutral-900/50 p-4">
        <PersonalNoteForm
          initial={note}
          onCancel={() => setIsEditing(false)}
          onSubmit={async (input) => {
            const ok = await onUpdate(note.id, input);
            if (ok) setIsEditing(false);
            return ok;
          }}
        />
      </li>
    );
  }

  return (
    <li className={`rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 ${isDone ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={isDone}
          onChange={() => void onUpdate(note.id, { done: !isDone })}
          aria-label={isDone ? t('notes.markUndone') : t('notes.markDone')}
          className="mt-1 h-4 w-4 accent-violet-500"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={`break-words font-medium text-white ${isDone ? 'line-through' : ''}`}>{note.title}</h3>
            {note.pinned && (
              <span className="rounded-full border border-violet-700 px-2 py-0.5 text-xs text-violet-300">
                {t('notes.pinned')}
              </span>
            )}
            {state && note.remindAt && (
              <span className={`rounded-full border px-2 py-0.5 text-xs ${REMINDER_CLASS[state]}`}>
                {t(REMINDER_KEY[state], { when: formatDateTime(note.remindAt) })}
              </span>
            )}
          </div>
          {/* Texto do utilizador: nunca como HTML. */}
          {note.body && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-neutral-300">{note.body}</p>}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <button type="button" className={LINK_BUTTON} onClick={() => setIsEditing(true)}>
              {t('notes.edit')}
            </button>
            <button type="button" className={LINK_BUTTON} onClick={() => void onUpdate(note.id, { pinned: !note.pinned })}>
              {note.pinned ? t('notes.unpin') : t('notes.pin')}
            </button>
            {note.remindAt && !isDone && (
              <button type="button" className={LINK_BUTTON} onClick={() => void onUpdate(note.id, { remindAt: null })}>
                {t('notes.clearReminder')}
              </button>
            )}
          </div>
        </div>
        <IconButton label={t('notes.delete')} tone="danger" onClick={() => onRemove(note)}>
          <TrashIcon />
        </IconButton>
      </div>
    </li>
  );
}

export default memo(PersonalNoteItem);
