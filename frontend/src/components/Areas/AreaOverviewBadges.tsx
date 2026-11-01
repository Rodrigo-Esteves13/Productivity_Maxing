import type { AreaOverviewItem } from '../../lib/areaOverview';
import { RISK_LEVEL_STYLE } from '../../lib/courseRisk';
import { daysUntil, formatDaysUntil } from '../../lib/areaList';
import { useI18n } from '../../i18n/useI18n';
import Skeleton from '../UI/Skeleton';
import { ClockIcon } from '../UI/Icons';

interface AreaOverviewBadgesProps {
  item: AreaOverviewItem | undefined;
  isLoading: boolean;
  // Alguma fonte falhou: sem dados nao se afirma "sem tarefas".
  failed: boolean;
}

const CHIP_CLASS = 'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium tabular-nums';
const NEUTRAL_CHIP = 'border-neutral-700 bg-neutral-800/60 text-neutral-300';
const OVERDUE_CHIP = 'border-red-800 bg-red-900/20 text-red-300';

// Selos do resumo de uma cadeira: risco, em atraso, abertas e proximo prazo.
// Cores do risco iguais as da pagina /risk (sem verde; baixo fica neutro).
export default function AreaOverviewBadges({ item, isLoading, failed }: AreaOverviewBadgesProps) {
  const { t, lang } = useI18n();

  if (isLoading) {
    return (
      <div aria-hidden="true" className="flex gap-1.5">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
    );
  }

  const openTasks = item?.openTasks ?? 0;
  const overdue = item?.overdueTasks ?? 0;
  const riskLevel = item?.riskLevel ?? null;
  const showNoTasks = openTasks === 0 && !failed;
  if (!riskLevel && openTasks === 0 && !showNoTasks) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {riskLevel && (
          <span className={`${CHIP_CLASS} ${RISK_LEVEL_STYLE[riskLevel].badge}`}>
            {t('areas.card.risk', { level: t(`courseRisk.level.${riskLevel}`) })}
          </span>
        )}
        {overdue > 0 && <span className={`${CHIP_CLASS} ${OVERDUE_CHIP}`}>{t('areas.card.overdue', { count: overdue })}</span>}
        {openTasks > 0 && (
          <span className={`${CHIP_CLASS} ${NEUTRAL_CHIP}`}>{t('areas.card.openTasks', { count: openTasks })}</span>
        )}
        {showNoTasks && <span className="text-xs text-neutral-500">{t('areas.card.noTasks')}</span>}
      </div>
      {item?.nextDeadline && (
        <p className="flex items-center gap-1.5 text-xs text-neutral-400">
          <ClockIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          {t('areas.card.nextDeadline', { when: formatDaysUntil(daysUntil(item.nextDeadline), lang) })}
        </p>
      )}
    </div>
  );
}
