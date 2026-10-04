import { useState } from 'react';
import ActionButton from '../UI/ActionButton';
import ErrorState from '../UI/ErrorState';
import { GoogleIcon } from '../UI/Icons';
import { useCalendarStatus } from '../../hooks/useCalendarStatus';
import { removeSyncedSchedule } from '../../api/calendarService';
import type { RemoveAllResult } from '../../api/calendarService';
import { requestCalendarSyncReview } from '../../lib/calendarSyncEvents';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export default function ScheduleSyncCard() {
  const connected = useCalendarStatus();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [removed, setRemoved] = useState<RemoveAllResult | null>(null);
  const [error, setError] = useState('');

  // A carregar o estado da ligação: nada a mostrar ainda.
  if (connected === null) return null;

  const handleRemoveAll = async () => {
    try {
      setIsRemoving(true);
      setError('');
      setRemoved(await removeSyncedSchedule());
    } catch {
      setError('Could not remove the synced events.');
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 sm:p-6 mt-6">
      <h2 className="text-lg font-semibold text-white mb-1">Google Calendar</h2>

      {!connected ? (
        <>
          <p className="text-sm text-neutral-400 mb-4">
            Connect Google Calendar to see your classes, work, travel time and study
            blocks there. You will be asked to confirm before anything is written.
          </p>
          <a
            href={`${apiUrl}/auth/google/link-calendar`}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-violet-600 hover:bg-violet-500 text-white"
          >
            <GoogleIcon />
            Connect Google Calendar
          </a>
        </>
      ) : (
        <>
          <p className="text-sm text-neutral-400 mb-4">
            Connected. Whenever your schedule, work or study plan changes you will be
            asked to confirm the update. Only events this app created are ever edited.
          </p>

          {removed && (
            <p role="status" className="text-sm text-emerald-300 mb-3">
              Removed {removed.deleted} events.
              {removed.remaining > 0 && ` ${removed.remaining} left, press remove again.`}
            </p>
          )}
          {error && <ErrorState message={error} />}

          <div className="flex flex-wrap items-center gap-2">
            <ActionButton onClick={() => requestCalendarSyncReview({ force: true })}>
              Review and sync now
            </ActionButton>

            {!confirmRemove ? (
              <button
                type="button"
                onClick={() => setConfirmRemove(true)}
                className="px-3 py-2 text-sm rounded-lg border border-neutral-700 text-neutral-400 hover:text-white"
              >
                Remove synced events
              </button>
            ) : (
              <span className="flex items-center gap-2 text-sm">
                <span className="text-neutral-400">Delete all events this app added?</span>
                <button
                  type="button"
                  disabled={isRemoving}
                  onClick={() => {
                    setConfirmRemove(false);
                    void handleRemoveAll();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-red-600/80 hover:bg-red-600 text-white"
                >
                  {isRemoving ? 'Removing...' : 'Yes, remove'}
                </button>
                <button type="button" onClick={() => setConfirmRemove(false)} className="text-neutral-400 hover:text-white">
                  Cancel
                </button>
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
