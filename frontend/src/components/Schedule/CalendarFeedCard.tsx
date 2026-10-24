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
import { useI18n } from '../../i18n/useI18n';
import Card from '../UI/Card';
import ToggleRow from '../UI/ToggleRow';

// Feed .ics subscrivivel: classes, turnos, viagens, blocos de estudo e tasks
// no Google/Apple/Outlook Calendar sem OAuth. So leitura.
export default function CalendarFeedCard() {
  const { t } = useI18n();
  const { confirm, notify } = useFeedback();
  const [status, setStatus] = useState<CalendarFeedStatus | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  // So muda o link mostrado; o mesmo token serve as duas variantes.
  const [tasksOnly, setTasksOnly] = useState(false);

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
      title: t('ui.createANewLink'),
      message:
        t('ui.theCurrentLinkStopsWorking'),
      confirmLabel: t('ui.createNewLink'),
      tone: 'danger',
    });
    if (ok) await run(enableCalendarFeed, t('ui.couldNotCreateANew'));
  };

  const handleDisable = async () => {
    const ok = await confirm({
      title: t('ui.turnOffTheFeed'),
      message: t('ui.theLinkWillStopWorking'),
      confirmLabel: t('ui.turnOff'),
      tone: 'danger',
    });
    if (ok) await run(disableCalendarFeed, t('ui.couldNotTurnOffThe'));
  };

  if (loadFailed) return null;
  if (status === null) return null;

  const url = status.token ? feedUrl(status.token, tasksOnly) : null;

  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
          <CalendarIcon className="text-violet-400" width={18} height={18} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-white">{t('ui.calendarFeedIcs')}</h2>
          <p className="text-sm text-neutral-400 mt-0.5">
            {t('ui.subscribeInGoogleAppleOr')}
          </p>
        </div>
      </div>

      {!status.enabled || !url ? (
        <button
          type="button"
          disabled={isBusy}
          onClick={() => void run(enableCalendarFeed, t('ui.couldNotCreateTheLink'))}
          className="mt-4 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 transition-colors"
        >
          {isBusy ? t('common.creating') : t('ui.createSubscriptionLink')}
        </button>
      ) : (
        <div className="mt-4 space-y-3">
          <ToggleRow
            variant="inline"
            label={t('calendarFeed.tasksOnly')}
            description={t('calendarFeed.tasksOnlyHelp')}
            checked={tasksOnly}
            onChange={setTasksOnly}
          />
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 min-w-0 rounded-lg bg-neutral-950 border border-neutral-800 px-3 py-2 text-xs text-neutral-300 font-mono"
              aria-label={t('ui.calendarFeedUrl')}
            />
            <CopyButton text={url} />
          </div>
          <p className="text-xs text-neutral-500">
            {t('ui.anyoneWithThisLinkCan')}
          </p>
          <div className="flex flex-wrap gap-3 text-sm">
            <a
              href={feedWebcalUrl(status.token as string, tasksOnly)}
              className="underline text-violet-400 hover:text-violet-300"
            >
              {t('ui.openInCalendarApp')}
            </a>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => void handleRotate()}
              className="text-neutral-400 hover:text-white disabled:opacity-50"
            >
              {t('ui.newLink')}
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => void handleDisable()}
              className="text-neutral-400 hover:text-red-400 disabled:opacity-50"
            >
              {t('ui.turnOff')}
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
