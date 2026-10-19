import Modal from '../UI/Modal';
import ActionButton from '../UI/ActionButton';
import { useAuth } from '../../context/useAuth';
import { useCalendarSyncReview } from '../../hooks/useCalendarSyncReview';
import { formatClock, formatDayLabel } from '../../lib/timeFormat';
import type { SchedulePreview, SyncAction } from '../../api/calendarService';
import { useI18n } from '../../i18n/useI18n';

const ACTION_LABEL: Record<SyncAction, string> = {
  create: 'Add',
  update: 'Update',
  remove: 'Remove',
};

const ACTION_CLASS: Record<SyncAction, string> = {
  create: 'text-sky-400',
  update: 'text-amber-400',
  remove: 'text-red-400',
};

function Summary({ preview }: { preview: SchedulePreview }) {
  const { t } = useI18n();
  // Por ordem de ocorrencia (dia e hora), nao pela ordem em que o servidor as calculou.
  const sortedItems = [...preview.items].sort(
    (a, b) => a.date.localeCompare(b.date) || a.startMinutes - b.startMinutes,
  );
  const hasChanges = preview.create + preview.update + preview.remove > 0;
  if (!hasChanges) {
    return <p className="text-sm text-neutral-300">{t('ui.yourGoogleCalendarIsAlready')}</p>;
  }
  return (
    <>
      <p className="text-sm text-neutral-300 mb-3">
        {t('ui.scheduleChangedUpdateCalendar', { days: preview.days })}
        <span className="block text-xs text-neutral-500 mt-1">
          {t('ui.onlyEventsThisAppCreated')}
        </span>
      </p>
      <p className="text-sm mb-3">
        <span className="text-sky-400">{t('ui.toAdd', { create: preview.create })}</span>
        {' · '}
        <span className="text-amber-400">{t('ui.toUpdate', { update: preview.update })}</span>
        {' · '}
        <span className="text-red-400">{t('ui.toRemove', { remove: preview.remove })}</span>
      </p>
      <ul className="space-y-1 max-h-56 overflow-y-auto rounded-lg bg-neutral-800/40 p-2">
        {sortedItems.map((item, index) => (
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
          <li className="text-xs text-neutral-500 px-1">{t('ui.andMore', { hiddenCount: preview.hiddenCount })}</li>
        )}
      </ul>
      {!preview.withinLimit && (
        <p className="text-xs text-amber-400 mt-2">
          {t('ui.thatIsTooManyChanges')}
        </p>
      )}
    </>
  );
}

// Montado uma vez na app (AppRouter): abre sozinho quando algo que o
// calendário devia refletir mudou, e pede Confirm ou Deny. Ao contrário de
// um botão "Check changes" + "Sync now", não depende de a pessoa se lembrar.
export default function CalendarSyncReviewModal() {
  const { t } = useI18n();
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
      title={t('ui.updateGoogleCalendar')}
    >
      {phase === 'done' && result ? (
        <>
          <p role="status" className="text-sm text-sky-300">
            {t('ui.syncResultCounts', { created: result.created, updated: result.updated, deleted: result.deleted })}
            {result.failed > 0 && (
              <span className="text-amber-400"> {t('ui.failedMakeAnotherChangeOr', { failed: result.failed })}</span>
            )}
          </p>
          <div className="mt-4 flex justify-end">
            <ActionButton onClick={deny}>{t('ui.close')}</ActionButton>
          </div>
        </>
      ) : phase === 'error' ? (
        <>
          <p role="alert" className="text-sm text-red-300">
            {t('ui.couldNotReachGoogleCalendar')}
          </p>
          <div className="mt-4 flex justify-end">
            <ActionButton onClick={deny}>{t('ui.close')}</ActionButton>
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
              {hasChanges ? t('ui.deny') : t('ui.close')}
            </button>
            {hasChanges && (
              <ActionButton onClick={() => void confirm()} disabled={!canConfirm || isBusy}>
                {isBusy ? t('ui.syncing') : t('ui.confirm')}
              </ActionButton>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
