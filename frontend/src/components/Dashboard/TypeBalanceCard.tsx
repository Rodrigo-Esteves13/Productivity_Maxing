import { useMemo } from 'react';
import type { Task } from '../../types/models';
import { BALANCE_WINDOW_DAYS, computeTypeBalance } from '../../lib/typeBalance';
import { ChartPieIcon } from '../UI/Icons';
import ProgressBar from '../UI/ProgressBar';
import DashboardCard, { CardBody, CardHeading } from '../UI/DashboardCard';
import { useCatalogLabel } from '../../hooks/useCatalogLabel';
import { useI18n } from '../../i18n/useI18n';

interface TypeBalanceCardProps {
  // Todas as tasks (academicas, habitos, projetos...), nao so as academicas.
  tasks: Task[];
}

// Equilibrio entre tipos de task nos ultimos 30 dias.
export default function TypeBalanceCard({ tasks }: TypeBalanceCardProps) {
  const { t } = useI18n();
  const { catalogLabel } = useCatalogLabel();
  const balance = useMemo(() => computeTypeBalance(tasks), [tasks]);
  if (!balance) return null;

  return (
    <DashboardCard fillBody>
      <CardHeading className="mb-3">
        <ChartPieIcon className="shrink-0" />
        {t('typeBalance.title')}
      </CardHeading>
      <CardBody>
        <ul className="space-y-2">
          {balance.shares.map((share) => (
            <li key={share.type} className="text-sm">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-neutral-300">{catalogLabel('taskType', share.type, null)}</span>
                <span className="text-xs text-neutral-400 tabular-nums">
                  {t('typeBalance.share', { percent: share.percent, count: share.count })}
                </span>
              </div>
              <ProgressBar percent={share.percent} thickness="sm" />
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-neutral-500">{t('typeBalance.hint', { days: BALANCE_WINDOW_DAYS })}</p>
      </CardBody>
    </DashboardCard>
  );
}
