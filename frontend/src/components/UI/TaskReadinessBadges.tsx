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
  // 'chip' (por omissao): pilula, como nos cartoes de Tasks. 'badge': mesma
  // familia dos DifficultyBadge/PriorityBadge (10px, maiusculas, rounded-md),
  // para o Dashboard, onde estes chips ficam lado a lado com esses badges.
  variant?: 'chip' | 'badge';
}


const CHIP_BASE = 'inline-flex items-center gap-1 whitespace-nowrap';
const CHIP_STYLE: Record<NonNullable<TaskReadinessBadgesProps['variant']>, string> = {
  chip: `${CHIP_BASE} rounded-full px-2 py-0.5 text-[11px] font-medium`,
  badge: `${CHIP_BASE} rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider`,
};
const LOCKED_STYLE: Record<NonNullable<TaskReadinessBadgesProps['variant']>, string> = {
  chip: 'bg-neutral-800 text-neutral-300',
  badge: 'border-neutral-700 bg-neutral-800/60 text-neutral-300',
};
const EFFORT_STYLE = 'border border-neutral-600 text-neutral-200';
const ICON_SIZE: Record<NonNullable<TaskReadinessBadgesProps['variant']>, string> = {
  chip: 'h-3 w-3',
  badge: 'h-2.5 w-2.5',
};

// Chips pequenos para o que a data e a dificuldade nao dizem: ainda nao da
// para comecar e esforco alto. A certeza da data vive no proprio texto da
// data (formatTaskDue: "Date TBD", "Surprise", "~ data"). Nada aparece para o
// caso normal (data exata, disponivel, esforco moderado), por isso nao faz
// ruido nos cartoes. Tasks concluidas nao mostram nada disto.
function TaskReadinessBadges({ task, className = '', variant = 'chip' }: TaskReadinessBadgesProps) {
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
        <span title={t('readiness.lockedHelp')} className={`${CHIP_STYLE[variant]} ${LOCKED_STYLE[variant]}`}>
          <LockIcon className={ICON_SIZE[variant]} aria-hidden="true" />
          {lockedLabel}
        </span>
      )}
      {effort && (
        // Contorno neutro: o ambar colidia com o acento do tema Sunset (o
        // violet-* passa a ambar) e o chip de esforco ficava igual ao de data.
        <span title={t('readiness.effortHelp')} className={`${CHIP_STYLE[variant]} ${EFFORT_STYLE}`}>
          <DumbbellIcon className={ICON_SIZE[variant]} aria-hidden="true" />
          {enumLabel(effort)}
        </span>
      )}
    </span>
  );
}

export default memo(TaskReadinessBadges);
