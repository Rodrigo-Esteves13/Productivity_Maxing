import { useMemo, useState } from 'react';
import type { Area, Task } from '../../types/models';
import { pickForEnergy } from '../../lib/energyMatch';
import { useMoodToday } from '../../hooks/useMoodToday';
import { useStartFiveMinutes } from '../../hooks/useStartFiveMinutes';
import { formatTaskDue } from '../../lib/taskReadiness';
import { getDateStatus, getRemainingTimeLabel } from '../../utils/taskDateStatus';
import { useI18n } from '../../i18n/useI18n';
import EmptyState from '../UI/EmptyState';
import ToolbarButton from '../UI/ToolbarButton';
import { CheckIcon, ClockIcon, XIcon } from '../UI/Icons';

interface SingleTaskViewProps {
  tasks: Task[];
  areas: Area[];
  onComplete: (task: Task) => Promise<void>;
  onExit: () => void;
}

// Modo "uma so task": substitui os cartoes por um unico cartao grande com a
// task aberta mais urgente. Concluir usa o mesmo fluxo (com Undo) da tabela.
export default function SingleTaskView({ tasks, areas, onComplete, onExit }: SingleTaskViewProps) {
  const { t } = useI18n();
  const [isCompleting, setIsCompleting] = useState(false);
  const { log: mood } = useMoodToday();
  const energy = mood?.energy ?? null;
  const { task, byEnergy } = useMemo(() => pickForEnergy(tasks, energy), [tasks, energy]);
  const { startFiveMinutes, canStart, minutes } = useStartFiveMinutes();
  const areaName = useMemo(
    () => (task ? areas.find((area) => area.id === task.areaId)?.name ?? '' : ''),
    [task, areas],
  );

  const exitButton = (
    <ToolbarButton tone="muted" size="md" onClick={onExit}>
      <XIcon />
      {t('singleTaskMode.exit')}
    </ToolbarButton>
  );

  if (!task) {
    return (
      <div className="mb-6">
        <EmptyState message={t('singleTaskMode.empty')} action={exitButton} />
      </div>
    );
  }

  const isOverdue = getDateStatus(task) === 'overdue';

  const handleComplete = async () => {
    setIsCompleting(true);
    try {
      await onComplete(task);
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <section className="mb-6 rounded-xl border border-neutral-800 bg-neutral-900/50 p-8 text-center">
      <p className="text-xs uppercase tracking-wide text-neutral-500">{t('singleTaskMode.label')}</p>
      {byEnergy && (
        <p className="mt-2 inline-block rounded-full border border-violet-700 px-2 py-0.5 text-xs text-violet-300" title={t('energyMatch.pickedHelp')}>
          {t('energyMatch.picked', { energy: energy ?? '' })}
        </p>
      )}
      <h2 className="mt-3 text-3xl font-semibold text-neutral-100 break-words">{task.title}</h2>
      {areaName && <p className="mt-2 text-sm text-neutral-400">{areaName}</p>}
      <p className="mt-4 text-lg text-neutral-300">{formatTaskDue(task)}</p>
      <p className={`mt-1 text-sm ${isOverdue ? 'text-red-400' : 'text-neutral-400'}`}>
        {getRemainingTimeLabel(task)}
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={handleComplete}
          disabled={isCompleting}
          className="pointer-coarse:min-h-11 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          <CheckIcon />
          {t('singleTaskMode.markDone')}
        </button>
        {canStart && (
          <ToolbarButton tone="muted" size="md" title={t('startFive.help', { minutes })} onClick={() => void startFiveMinutes(task)}>
            <ClockIcon />
            {t('startFive.button', { minutes })}
          </ToolbarButton>
        )}
        {exitButton}
      </div>
    </section>
  );
}
