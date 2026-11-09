import { useMemo } from 'react';
import type { Area, Task } from '../../types/models';
import {
  MIN_QUALIFYING_AREAS,
  computeAreaConsistency,
  type AreaConsistency,
} from '../../lib/areaConsistency';
import { scaleMax } from '../../lib/gradeScale';
import { ChartPieIcon } from '../UI/Icons';
import ProgressBar from '../UI/ProgressBar';
import DashboardCard, { CardBody, CardHeading } from '../UI/DashboardCard';
import { useI18n } from '../../i18n/useI18n';

interface AreaConsistencyCardProps {
  tasks: Task[];
  areas: Area[];
  scale: string;
}

// How many areas to list at each end of the ranking.
const LIST_SIZE = 2;

function Row({ item }: { item: AreaConsistency }) {
  const { t } = useI18n();
  return (
    <li className="text-sm">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-x-2">
        <span className="min-w-0 truncate text-neutral-300">{item.name}</span>
        <span className="flex gap-2 text-xs text-neutral-400">
          <span className="font-semibold text-white">{t('areaConsistency.score', { score: item.score })}</span>
          <span>{t(`areaConsistency.bucket.${item.bucket}`)}</span>
          <span>{t('areaConsistency.count', { count: item.gradedCount })}</span>
        </span>
      </div>
      <ProgressBar percent={item.score} thickness="sm" />
    </li>
  );
}

// Courses ranked by how steady the grades and deadlines are.
export default function AreaConsistencyCard({ tasks, areas, scale }: AreaConsistencyCardProps) {
  const { t } = useI18n();
  const ranked = useMemo(
    () => computeAreaConsistency(tasks, areas, scaleMax(scale)),
    [tasks, areas, scale],
  );
  if (ranked.length < MIN_QUALIFYING_AREAS) return null;

  const top = ranked.slice(0, LIST_SIZE);
  const bottom = ranked
    .slice(Math.max(top.length, ranked.length - LIST_SIZE))
    .reverse();

  return (
    <DashboardCard fillBody>
      <CardHeading className="mb-3">
        <ChartPieIcon className="shrink-0" />
        {t('areaConsistency.title')}
      </CardHeading>
      <CardBody>
        <p className="mb-3 text-xs text-neutral-400">{t('areaConsistency.hint')}</p>
        <p className="mb-1 text-xs font-medium uppercase text-neutral-500">{t('areaConsistency.top')}</p>
        <ul className="mb-3 space-y-2">
          {top.map((item) => (
            <Row key={item.areaId} item={item} />
          ))}
        </ul>
        {bottom.length > 0 && (
          <>
            <p className="mb-1 text-xs font-medium uppercase text-neutral-500">{t('areaConsistency.bottom')}</p>
            <ul className="space-y-2">
              {bottom.map((item) => (
                <Row key={item.areaId} item={item} />
              ))}
            </ul>
          </>
        )}
      </CardBody>
    </DashboardCard>
  );
}
