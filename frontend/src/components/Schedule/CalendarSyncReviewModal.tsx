import Modal from '../UI/Modal';
import ActionButton from '../UI/ActionButton';
import { useAuth } from '../../context/useAuth';
import { useCalendarSyncReview } from '../../hooks/useCalendarSyncReview';
import { formatClock, formatDayLabel } from '../../lib/timeFormat';
import type { SchedulePreview, SyncAction } from '../../api/calendarService';

const ACTION_LABEL: Record<SyncAction, string> = {
  create: 'Add',
  update: 'Update',
  remove: 'Remove',
};

const ACTION_CLASS: Record<SyncAction, string> = {
  create: 'text-emerald-400',
  update: 'text-amber-400',
  remove: 'text-red-400',
};

function Summary({ preview }: { preview: SchedulePreview }) {
  const hasChanges = preview.create + preview.update + preview.remove > 0;
  if (!hasChanges) {
    return <p className="text-sm text-neutral-300">Your Google Calendar is already up to date.</p>;
  }
  return (
    <>
      <p className="text-sm text-neutral-300 mb-3">
        Your schedule changed. Update Google Calendar for the next {preview.days} days?
        <span className="block text-xs text-neutral-500 mt-1">
          Only events this app created are touched, never your own.
        </span>
      </p>
      <p className="text-sm mb-3">
        <span className="text-emerald-400">{preview.create} to add</span>
        {' · '}
        <span className="text-amber-400">{preview.update} to update</span>
        {' · '}
        <span className="text-red-400">{preview.remove} to remove</span>
      </p>
      <ul className="space-y-1 max-h-56 overflow-y-auto rounded-lg bg-neutral-800/40 p-2">
        {preview.items.map((item, index) => (
          <li key={`${item.action}-${item.date}-${item.startMinutes}-${index}`} className="flex gap-2 text-xs">
            <span className={`w-14 shrink-0 font-medium ${ACTION_CLASS[item.action]}`}>
              {ACTION_LABEL[item.action]}
            </span>
            <span className="text-neutral-200 truncate">{item.title}</span>
            <span className="ml-auto shrink-0 text-neutral-500">
              {formatDayLabel(item.date)} {formatClock(item.startMinutes)}-{formatClock(item.endMinutes)}
            </span>
          </li>
        ))}
        {preview.hiddenCount > 0 && (
          <li className="text-xs text-neutral-500 px-1">and {preview.hiddenCount} more</li>
        )}
      </ul>
      {!preview.withinLimit && (
        <p className="text-xs text-amber-400 mt-2">
          That is too many changes for one sync. Remove some commitments or shifts first.
        </p>
      )}
    </>
  );
}

// Montado uma vez na app (AppRouter): abre sozinho quando algo que o
// calendário devia refletir mudou, e pede Confirm ou Deny. Ao contrário de
// um botão "Check changes" + "Sync now", não depende de a pessoa se lembrar.
export default function CalendarSyncReviewModal() {
  const { isAuthenticated } = useAuth();
  const { phase, preview, result, confirm, deny } = useCalendarSyncReview();

  if (!isAuthenticated || phase === 'closed') return null;

  const isBusy = phase === 'syncing';
  const hasChanges = !!preview && preview.create + preview.update + preview.remove > 0;
  const canConfirm = phase === 'review' && hasChanges && !!preview?.withinLimit;

  return (
    <Modal
      isOpen
      // Esc e clique no fundo contam como Deny, exceto enquanto escreve.
      onClose={() => !isBusy && deny()}
      title="Update Google Calendar"
    >
      {phase === 'done' && result ? (
        <>
          <p role="status" className="text-sm text-emerald-300">
            Added {result.created}, updated {result.updated}, removed {result.deleted}.
            {result.failed > 0 && (
              <span className="text-amber-400"> {result.failed} failed. Make another change or sync again to retry.</span>
            )}
          </p>
          <div className="mt-4 flex justify-end">
            <ActionButton onClick={deny}>Close</ActionButton>
          </div>
        </>
      ) : phase === 'error' ? (
        <>
          <p role="alert" className="text-sm text-red-300">
            Could not reach Google Calendar. Check your connection in Profile and try again.
          </p>
          <div className="mt-4 flex justify-end">
            <ActionButton onClick={deny}>Close</ActionButton>
          </div>
        </>
      ) : (
        <>
          {preview && <Summary preview={preview} />}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={deny}
              disabled={isBusy}
              className="px-4 py-2 text-sm rounded-lg border border-neutral-700 text-neutral-300 hover:text-white disabled:opacity-50"
            >
              {hasChanges ? 'Deny' : 'Close'}
            </button>
            {hasChanges && (
              <ActionButton onClick={() => void confirm()} disabled={!canConfirm || isBusy}>
                {isBusy ? 'Syncing...' : 'Confirm'}
              </ActionButton>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
