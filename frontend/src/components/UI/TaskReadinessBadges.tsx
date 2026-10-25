import { memo } from 'react';
import type { ComponentType, SVGProps } from 'react';
import type { DateCertainty, Task } from '../../types/models';
import { DumbbellIcon, HelpCircleIcon, LockIcon, ZapIcon } from './Icons';
import { useI18n } from '../../i18n/useI18n';
import { useEnumLabel } from '../../hooks/useEnumLabel';
import { formatTaskDate } from '../../lib/timeFormat';
import { isLocked, isNotableEffort } from '../../lib/taskReadiness';

type ReadinessTask = Pick<Task, 'isBlocked' | 'availableFrom' | 'dateCertainty' | 'effort' | 'progressStatus'>;

interface TaskReadinessBadgesProps {
  task: ReadinessTask;
  className?: string;
}

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

// So as certezas que merecem aviso (EXACT e o normal). Mapa em vez de ifs.
const CERTAINTY_BADGE: Partial<Record<DateCertainty, { icon: IconComponent; labelKey: string }>> = {
  APPROXIMATE: { icon: HelpCircleIcon, labelKey: 'readiness.badge.approximate' },
  UNKNOWN: { icon: HelpCircleIcon, labelKey: 'readiness.badge.unknown' },
  SURPRISE: { icon: ZapIcon, labelKey: 'readiness.badge.surprise' },
};

const CHIP = 'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium';

// Chips pequenos para o que a data e a dificuldade nao dizem: ainda nao da
// para comecar, data por marcar/surpresa e esforco alto. Nada aparece para o
// caso normal (data exata, disponivel, esforco moderado), por isso nao faz
// ruido nos cartoes. Tasks concluidas nao mostram nada disto.
function TaskReadinessBadges({ task, className = '' }: TaskReadinessBadgesProps) {
  const { t, lang } = useI18n();
  const enumLabel = useEnumLabel();
  if (task.progressStatus === 'COMPLETED') return null;

  const locked = isLocked(task);
  const certainty = CERTAINTY_BADGE[task.dateCertainty];
  const effort = isNotableEffort(task.effort) ? task.effort : null;
  if (!locked && !certainty && !effort) return null;

  const lockedLabel =
    task.availableFrom && !task.isBlocked
      ? t('readiness.badge.opens', { date: formatTaskDate(task.availableFrom, lang) })
      : t('readiness.badge.locked');
  const CertaintyIcon = certainty?.icon;

  return (
    <span className={`inline-flex flex-wrap items-center gap-1.5 ${className}`}>
      {locked && (
        <span title={t('readiness.lockedHelp')} className={`${CHIP} bg-neutral-800 text-neutral-300`}>
          <LockIcon className="h-3 w-3" aria-hidden="true" />
          {lockedLabel}
        </span>
      )}
      {certainty && CertaintyIcon && (
        <span title={t(`readiness.dateHelp.${task.dateCertainty}`)} className={`${CHIP} bg-violet-500/10 text-violet-300`}>
          <CertaintyIcon className="h-3 w-3" aria-hidden="true" />
          {t(certainty.labelKey)}
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
