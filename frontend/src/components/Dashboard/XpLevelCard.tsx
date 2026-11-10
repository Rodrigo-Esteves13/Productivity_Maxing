import { useMemo } from 'react';
import type { Task } from '../../types/models';
import { computeXpLevel } from '../../lib/xpLevel';
import { StarIcon } from '../UI/Icons';
import ProgressBar from '../UI/ProgressBar';
import DashboardCard, { CardBody, CardHeading } from '../UI/DashboardCard';
import { useI18n } from '../../i18n/useI18n';

interface XpLevelCardProps {
  tasks: Task[];
}

// Indicador divertido de XP a partir das tarefas concluidas; nao bloqueia nada.
export default function XpLevelCard({ tasks }: XpLevelCardProps) {
  const { t } = useI18n();
  const result = useMemo(() => computeXpLevel(tasks), [tasks]);

  return (
    <DashboardCard fillBody>
      <CardHeading className="mb-3">
        <StarIcon className="shrink-0" />
        {t('xpLevel.title')}
      </CardHeading>
      <CardBody>
        <p className="mb-2 text-sm text-neutral-200">
          {t('xpLevel.level', { level: result.level })}
        </p>
        <ProgressBar percent={result.percent} thickness="sm" label={t('xpLevel.title')} />
        <p className="mt-2 text-xs text-neutral-500">
          {t('xpLevel.progress', { into: result.xpIntoLevel, next: result.xpForNext })}
        </p>
        <p className="mt-1 text-xs text-neutral-500">{t('xpLevel.total', { xp: result.xp })}</p>
        <p className="mt-2 text-xs text-neutral-400">{t('xpLevel.hint')}</p>
      </CardBody>
    </DashboardCard>
  );
}
