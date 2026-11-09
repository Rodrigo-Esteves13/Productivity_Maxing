import { useMemo } from 'react';
import type { Task } from '../../types/models';
import {
  WEEKLY_CHALLENGE_LINE_VARIANTS,
  computeWeeklyChallenge,
} from '../../lib/weeklyChallenge';
import { daySeed, pickVariantIndex } from '../../lib/greeting';
import { TargetIcon } from '../UI/Icons';
import ProgressBar from '../UI/ProgressBar';
import DashboardCard, { CardBody, CardHeading } from '../UI/DashboardCard';
import { useI18n } from '../../i18n/useI18n';

interface WeeklyChallengeCardProps {
  tasks: Task[];
}

// Meta semanal gerada a partir do ritmo das ultimas semanas.
export default function WeeklyChallengeCard({ tasks }: WeeklyChallengeCardProps) {
  const { t } = useI18n();
  const challenge = useMemo(() => computeWeeklyChallenge(tasks, new Date()), [tasks]);
  const variant = pickVariantIndex(
    daySeed(`${challenge.status}-${challenge.progress}`),
    WEEKLY_CHALLENGE_LINE_VARIANTS,
  );

  return (
    <DashboardCard fillBody>
      <CardHeading className="mb-3">
        <TargetIcon className="shrink-0" />
        {t('weeklyChallenge.title')}
      </CardHeading>
      <CardBody>
        <p className="mb-2 text-sm text-neutral-200">
          {t('weeklyChallenge.progress', { done: challenge.progress, target: challenge.target })}
        </p>
        <ProgressBar
          percent={challenge.percent}
          thickness="sm"
          label={t('weeklyChallenge.title')}
        />
        <p className="mt-2 text-xs text-neutral-500">
          {t('weeklyChallenge.daysLeft', { count: challenge.daysLeft })}
        </p>
        <p className="mt-2 text-xs text-neutral-400">
          {t(`weeklyChallenge.line.${challenge.status}.${variant}`)}
        </p>
      </CardBody>
    </DashboardCard>
  );
}
