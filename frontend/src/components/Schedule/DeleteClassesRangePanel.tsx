import { useState } from 'react';
import Input from '../UI/Input';
import ToggleChip from '../UI/ToggleChip';
import { TrashIcon } from '../UI/Icons';
import { deleteImportedClasses } from '../../api/scheduleService';
import { addUtcDays, startOfWeek, todayUtcAnchored } from '../../lib/weekDates';
import { toDateKey } from '../../lib/dateKey';
import { useFeedback } from '../../context/useFeedback';
import { useI18n } from '../../i18n/useI18n';

interface DeleteClassesRangePanelProps {
  disabled?: boolean;
  // Depois de apagar: a grelha refaz o fetch e propoe limpar o Google Calendar.
  onDeleted: () => void;
}

const DAYS_IN_WEEK_AFTER_START = 6;

function thisWeekRange(): { from: string; to: string } {
  const start = startOfWeek(todayUtcAnchored());
  return { from: toDateKey(start), to: toDateKey(addUtcDays(start, DAYS_IN_WEEK_AFTER_START)) };
}

// Apagar so as aulas de um intervalo (esta semana, ou datas escolhidas),
// sem tocar nas restantes nem em turnos ou apontamentos do caderno.
export default function DeleteClassesRangePanel({ disabled = false, onDeleted }: DeleteClassesRangePanelProps) {
  const { t } = useI18n();
  const { confirm, notify } = useFeedback();
  const initial = thisWeekRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [isDeleting, setIsDeleting] = useState(false);

  const isThisWeek = from === thisWeekRange().from && to === thisWeekRange().to;
  const isInvalid = !from || !to || to < from;

  const changeFrom = (value: string) => {
    setFrom(value);
    // `to` acompanha `from` para o intervalo nunca ficar ao contrario.
    if (to < value) setTo(value);
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: t('ux4sched.range.confirmTitle'),
      message: t('ux4sched.range.confirmMessage', { from, to }),
      confirmLabel: t('ux4sched.range.confirmAction'),
      tone: 'danger',
    });
    if (!ok) return;
    setIsDeleting(true);
    try {
      const { deleted } = await deleteImportedClasses({ from, to });
      notify(t(deleted === 1 ? 'ui.importedClassesDeletedOne' : 'ui.importedClassesDeletedMany', { count: deleted }), 'success');
      onDeleted();
    } catch {
      notify(t('ui.couldNotDeleteTheImported'), 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-sm font-medium text-neutral-300">{t('ux4sched.range.title')}</legend>
      <div className="flex flex-wrap gap-1.5">
        <ToggleChip
          size="sm"
          pressed={isThisWeek}
          onClick={() => {
            const week = thisWeekRange();
            setFrom(week.from);
            setTo(week.to);
          }}
        >
          {t('ux4sched.range.thisWeek')}
        </ToggleChip>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label={t('ui.from')} type="date" value={from} onChange={(e) => changeFrom(e.target.value)} />
        <Input label={t('ui.to')} type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
      </div>
      <button
        type="button"
        onClick={() => void handleDelete()}
        disabled={disabled || isDeleting || isInvalid}
        className="inline-flex items-center gap-2 text-sm text-red-400 hover:text-red-300 disabled:opacity-50 pointer-coarse:min-h-11"
      >
        <TrashIcon width={14} height={14} />
        {isDeleting ? t('ui.deleting') : t('ux4sched.range.delete')}
      </button>
    </fieldset>
  );
}
