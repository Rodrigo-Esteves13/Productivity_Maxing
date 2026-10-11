import { useCallback, useEffect, useState } from 'react';
import { CalendarIcon } from '../UI/Icons';
import CopyButton from '../UI/CopyButton';
import {
  disableCalendarFeed,
  enableCalendarFeed,
  feedUrl,
  feedWebcalUrl,
  getCalendarFeed,
} from '../../api/calendarFeedService';
import { useFeedback } from '../../context/useFeedback';
import type { CalendarFeedStatus } from '../../types/models';

// Feed .ics subscrivivel: classes, turnos, viagens, blocos de estudo e tasks
// no Google/Apple/Outlook Calendar sem OAuth. So leitura.
export default function CalendarFeedCard() {
  const { confirm, notify } = useFeedback();
  const [status, setStatus] = useState<CalendarFeedStatus | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      setStatus(await getCalendarFeed());
    } catch {
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (action: () => Promise<CalendarFeedStatus>, errorMessage: string) => {
    setIsBusy(true);
    try {
      setStatus(await action());
    } catch {
      notify(errorMessage, 'error');
    } finally {
      setIsBusy(false);
    }
  };

  const handleRotate = async () => {
    const ok = await confirm({
      title: 'Create a new link',
      message:
        'The current link stops working immediately. Calendars subscribed to it will need the new link.',
      confirmLabel: 'Create new link',
      tone: 'danger',
    });
    if (ok) await run(enableCalendarFeed, 'Could not create a new link.');
  };

  const handleDisable = async () => {
    const ok = await confirm({
      title: 'Turn off the feed',
      message: 'The link will stop working. You can turn it on again later with a new link.',
      confirmLabel: 'Turn off',
      tone: 'danger',
    });
    if (ok) await run(disableCalendarFeed, 'Could not turn off the feed.');
  };

  if (loadFailed) return null;
  if (status === null) return null;

  const url = status.token ? feedUrl(status.token) : null;

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 sm:p-6 mt-6">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
          <CalendarIcon className="text-violet-400" width={18} height={18} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-white">Calendar feed (.ics)</h2>
          <p className="text-sm text-neutral-400 mt-0.5">
            Subscribe in Google, Apple or Outlook Calendar to see your classes, shifts, study blocks and
            task deadlines there. Read-only, no Google permission needed. Calendars refresh it on their
            own schedule (often every few hours).
          </p>
        </div>
      </div>

      {!status.enabled || !url ? (
        <button
          type="button"
          disabled={isBusy}
          onClick={() => void run(enableCalendarFeed, 'Could not create the link.')}
          className="mt-4 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 transition-colors"
        >
          {isBusy ? 'Creating...' : 'Create subscription link'}
        </button>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 min-w-0 rounded-lg bg-neutral-950 border border-neutral-800 px-3 py-2 text-xs text-neutral-300 font-mono"
              aria-label="Calendar feed URL"
            />
            <CopyButton text={url} />
          </div>
          <p className="text-xs text-neutral-500">
            Anyone with this link can read your schedule. Keep it private. In Google Calendar: Other
            calendars, From URL.
          </p>
          <div className="flex flex-wrap gap-3 text-sm">
            <a
              href={feedWebcalUrl(status.token as string)}
              className="underline text-violet-400 hover:text-violet-300"
            >
              Open in calendar app
            </a>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => void handleRotate()}
              className="text-neutral-400 hover:text-white disabled:opacity-50"
            >
              New link
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => void handleDisable()}
              className="text-neutral-400 hover:text-red-400 disabled:opacity-50"
            >
              Turn off
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
