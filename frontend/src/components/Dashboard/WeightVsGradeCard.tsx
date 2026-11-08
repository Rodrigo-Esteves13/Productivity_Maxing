import { useMemo } from 'react';
import type { Task } from '../../types/models';
import { computeWeightVsGrade } from '../../utils/weightVsGrade';
import { scaleMax } from '../../lib/gradeScale';
import { FULL_PERCENT } from '../../lib/percent';
import { ChartPieIcon } from '../UI/Icons';
import ProgressBar from '../UI/ProgressBar';
import DashboardCard, { CardBody, CardHeading } from '../UI/DashboardCard';
import { useI18n } from '../../i18n/useI18n';

interface WeightVsGradeCardProps {
  tasks: Task[];
  scale: string;
}

const INTERPRETATION_KEYS = {
  higherOnHeavy: 'weightVsGrade.higherOnHeavy',
  lowerOnHeavy: 'weightVsGrade.lowerOnHeavy',
  none: 'weightVsGrade.none',
} as const;

// Peso da avaliacao vs a nota real: correlacao e medias por balde de peso.
export default function WeightVsGradeCard({ tasks, scale }: WeightVsGradeCardProps) {
  const { t } = useI18n();
  const data = useMemo(() => computeWeightVsGrade(tasks), [tasks]);
  if (data.coefficient === null || data.kind === null) return null;

  const max = scaleMax(scale);

  return (
    <DashboardCard fillBody>
      <CardHeading className="mb-3">
        <ChartPieIcon className="shrink-0" />
        {t('weightVsGrade.label')}
      </CardHeading>
      <CardBody>
        <p className="mb-1 text-2xl font-semibold text-white">{data.coefficient}</p>
        <p className="mb-3 text-xs text-neutral-400">{t(INTERPRETATION_KEYS[data.kind])}</p>
        <ul className="space-y-2">
          {data.buckets
            .filter((b) => b.count > 0)
            .map((b) => (
              <li key={b.id} className="text-sm">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-x-2">
                  <span className="text-neutral-300">{t(`weightVsGrade.bucket.${b.id}`)}</span>
                  <span className="flex gap-2 text-xs text-neutral-400">
                    <span className="font-semibold text-white">{b.averageGrade}</span>
                    <span>{t('weightVsGrade.count', { count: b.count })}</span>
                  </span>
                </div>
                <ProgressBar percent={((b.averageGrade ?? 0) / max) * FULL_PERCENT} thickness="sm" />
              </li>
            ))}
        </ul>
      </CardBody>
    </DashboardCard>
  );
}
