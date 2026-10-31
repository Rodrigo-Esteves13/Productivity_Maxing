import { useState } from 'react';
import Select from '../UI/Select';
import { EFFORTS } from '../../lib/taskReadiness';
import type { Effort } from '../../types/models';
import { useEnumLabel } from '../../hooks/useEnumLabel';
import { CalendarIcon, CheckIcon, TrashIcon } from '../UI/Icons';
import { useFeedback } from '../../context/useFeedback';
import { useI18n } from '../../i18n/useI18n';
import { fillNodes } from '../../i18n/fillNodes';
import { todayKey, toDateKey } from '../../lib/dateKey';
import { addUtcDays, todayUtcAnchored } from '../../lib/weekDates';

interface BulkActionsBarProps {
  selectedCount: number;
  onMarkDone: () => Promise<void>;
  // Recebe o dia ("YYYY-MM-DD") e devolve quantas tasks mudaram de data.
  onReschedule: (dateKey: string) => Promise<number>;
  // Define (ou limpa, com null) o esforco das selecionadas; devolve quantas mudaram.
  onSetEffort: (effort: Effort | null) => Promise<number>;
  // removeFromCalendar: true quando o user aceitou remover tambem os eventos
  // ligados no Google Calendar.
  onDelete: (removeFromCalendar: boolean) => Promise<void>;
  onClear: () => void;
  // Quantas das selecionadas estao sincronizadas com o Google Calendar.
  syncedCount?: number;
}

// Shows up in place of nothing whenever at least one task is checked in
// TasksTable (desktop rows or mobile cards). Kept to the two actions
// that are actually useful in bulk - marking several tasks done at once
// and deleting several at once - rather than trying to bulk-edit every
// field, which would need its own modal and isn't a real use case.
// "Move to" (hoje, amanha ou um dia) junta-se a esses dois: e o caso real
// de varias tasks em atraso que so precisam de nova data.
// Valor da opcao que limpa o esforco (o select so trabalha com strings).
const CLEAR_EFFORT = 'CLEAR';

const MOVE_BUTTON_CLASS =
  'rounded-md border border-violet-800/60 px-2.5 py-1 text-sm text-violet-200 hover:bg-violet-900/40 transition-colors disabled:opacity-50';

export default function BulkActionsBar({
  selectedCount,
  onMarkDone,
  onReschedule,
  onSetEffort,
  onDelete,
  onClear,
  syncedCount = 0,
}: BulkActionsBarProps) {
  const { t } = useI18n();
  const { confirm, notify } = useFeedback();
  const enumLabel = useEnumLabel();
  const [isMarkingDone, setIsMarkingDone] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [isSettingEffort, setIsSettingEffort] = useState(false);

  if (selectedCount === 0) return null;
  const isBusy = isMarkingDone || isDeleting || isRescheduling || isSettingEffort;

  const handleReschedule = async (dateKey: string) => {
    setIsRescheduling(true);
    try {
      const count = await onReschedule(dateKey);
      notify(t(count === 1 ? 'bulkMove.doneOne' : 'bulkMove.doneMany', { count }), 'success');
    } catch {
      notify(t('bulkMove.failed'), 'error');
    } finally {
      setIsRescheduling(false);
    }
  };

  const handleSetEffort = async (value: string) => {
    if (!value) return;
    setIsSettingEffort(true);
    try {
      const count = await onSetEffort(value === CLEAR_EFFORT ? null : (value as Effort));
      notify(t(count === 1 ? 'bulkEffort.doneOne' : 'bulkEffort.doneMany', { count }), 'success');
    } catch {
      notify(t('bulkEffort.failed'), 'error');
    } finally {
      setIsSettingEffort(false);
    }
  };

  const handleMarkDone = async () => {
    setIsMarkingDone(true);
    try {
      await onMarkDone();
    } catch {
      notify(t('bulkActions.markDoneFailed'), 'error');
    } finally {
      setIsMarkingDone(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: t('ui.deleteTasks'),
      message: t(selectedCount === 1 ? 'ui.deleteSelectedTasksOne' : 'ui.deleteSelectedTasksMany', { count: selectedCount }),
      confirmLabel: t('common.delete'),
      tone: 'danger',
    });
    if (!confirmed) return;
    // Mesmo comportamento do apagar individual: so pergunta se houver
    // eventos ligados, e "remover" e a resposta por omissao.
    const removeFromCalendar =
      syncedCount > 0 &&
      (await confirm({
        title: t('hook.googleCalendar'),
        message: t('bulkActions.removeEventsMessage', { count: syncedCount }),
        confirmLabel: t('hook.removeEvent'),
        cancelLabel: t('hook.keepEvent'),
      }));
    setIsDeleting(true);
    try {
      await onDelete(removeFromCalendar);
    } catch {
      notify(t('bulkActions.deleteFailed'), 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="print-hide flex flex-wrap items-center justify-between gap-3 rounded-lg border border-violet-800/50 bg-violet-900/20 px-4 py-3 mb-4">
      <p className="text-sm text-neutral-200">
        {fillNodes(t('ui.selectedCount'), {
          count: <span className="font-semibold tabular-nums text-white">{selectedCount}</span>,
        })}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1 text-xs text-neutral-400">
          <CalendarIcon className="h-3.5 w-3.5" aria-hidden="true" />
          {t('bulkMove.label')}
        </span>
        <button
          type="button"
          onClick={() => handleReschedule(todayKey())}
          disabled={isBusy}
          className={MOVE_BUTTON_CLASS}
        >
          {t('bulkMove.today')}
        </button>
        <button
          type="button"
          onClick={() => handleReschedule(toDateKey(addUtcDays(todayUtcAnchored(), 1)))}
          disabled={isBusy}
          className={MOVE_BUTTON_CLASS}
        >
          {t('bulkMove.tomorrow')}
        </button>
        <input
          type="date"
          value=""
          aria-label={t('bulkMove.pickDate')}
          disabled={isBusy}
          onChange={(e) => {
            if (e.target.value) void handleReschedule(e.target.value);
          }}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm text-neutral-200 focus:outline-none focus:ring-2 focus:ring-violet-600/50 disabled:opacity-50 [color-scheme:dark]"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value=""
          aria-label={t('bulkEffort.label')}
          disabled={isBusy}
          onChange={(e) => void handleSetEffort(e.target.value)}
          className="py-1 text-sm"
        >
          <option value="">{t('bulkEffort.label')}</option>
          {EFFORTS.map((effort) => (
            <option key={effort} value={effort}>
              {enumLabel(effort)}
            </option>
          ))}
          <option value={CLEAR_EFFORT}>{t('bulkEffort.clear')}</option>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleMarkDone}
          disabled={isBusy}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-md transition-colors disabled:opacity-50"
        >
          <CheckIcon />
          {isMarkingDone ? t('ui.marking') : t('ui.markAsDone')}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isBusy}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-red-700 hover:bg-red-600 rounded-md transition-colors disabled:opacity-50"
        >
          <TrashIcon />
          {isDeleting ? t('ui.deleting') : t('common.delete')}
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={isBusy}
          className="px-3 py-1.5 text-sm text-neutral-400 hover:text-neutral-200 disabled:opacity-50"
        >
          {t('ui.clear')}
        </button>
      </div>
    </div>
  );
}
