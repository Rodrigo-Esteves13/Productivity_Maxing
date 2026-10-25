import { memo } from 'react';
import type { Task } from '../../types/models';
import { DumbbellIcon, LockIcon } from './Icons';
import { useI18n } from '../../i18n/useI18n';
import { useEnumLabel } from '../../hooks/useEnumLabel';
import { formatTaskDate } from '../../lib/timeFormat';
import { isLocked, isNotableEffort } from '../../lib/taskReadiness';

type ReadinessTask = Pick<Task, 'isBlocked' | 'availableFrom' | 'effort' | 'progressStatus'>;

interface TaskReadinessBadgesProps {
  task: ReadinessTask;
  className?: string;
}


const CHIP = 'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium';

// Chips pequenos para o que a data e a dificuldade nao dizem: ainda nao da
// para comecar e esforco alto. A certeza da data vive no proprio texto da
// data (formatTaskDue: "Date TBD", "Surprise", "~ data"). Nada aparece para o
// caso normal (data exata, disponivel, esforco moderado), por isso nao faz
// ruido nos cartoes. Tasks concluidas nao mostram nada disto.
function TaskReadinessBadges({ task, className = '' }: TaskReadinessBadgesProps) {
  const { t, lang } = useI18n();
  const enumLabel = useEnumLabel();
  if (task.progressStatus === 'COMPLETED') return null;

  const locked = isLocked(task);
  const effort = isNotableEffort(task.effort) ? task.effort : null;
  if (!locked && !effort) return null;

  const lockedLabel =
    task.availableFrom && !task.isBlocked
      ? t('readiness.badge.opens', { date: formatTaskDate(task.availableFrom, lang) })
      : t('readiness.badge.locked');

  return (
    <span className={`inline-flex flex-wrap items-center gap-1.5 ${className}`}>
      {locked && (
        <span title={t('readiness.lockedHelp')} className={`${CHIP} bg-neutral-800 text-neutral-300`}>
          <LockIcon className="h-3 w-3" aria-hidden="true" />
          {lockedLabel}
        </span>
      )}
      {effort && (
        // Contorno neutro: o ambar colidia com o acento do tema Sunset (o
        // violet-* passa a ambar) e o chip de esforco ficava igual ao de data.
        <span title={t('readiness.effortHelp')} className={`${CHIP} border border-neutral-600 text-neutral-200`}>
          <DumbbellIcon className="h-3 w-3" aria-hidden="true" />
          {enumLabel(effort)}
        </span>
      )}
    </span>
  );
}

export default memo(TaskReadinessBadges);
