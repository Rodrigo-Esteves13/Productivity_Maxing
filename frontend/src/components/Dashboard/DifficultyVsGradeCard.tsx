import { useMemo } from 'react';
import type { Task } from '../../types/models';
import { computeDifficultyVsGrade } from '../../utils/difficultyVsGrade';
import { scaleMax } from '../../lib/gradeScale';
import { FULL_PERCENT } from '../../lib/percent';
import { useEnumLabel } from '../../hooks/useEnumLabel';
import { ChartPieIcon } from '../UI/Icons';
import ProgressBar from '../UI/ProgressBar';
import DashboardCard, { CardBody, CardHeading } from '../UI/DashboardCard';
import { useI18n } from '../../i18n/useI18n';

interface DifficultyVsGradeCardProps {
  tasks: Task[];
  scale: string;
}

const MIN_GRADED_TO_SHOW = 3;
// Diferenca (na escala da nota) abaixo da qual se diz "quase igual".
const SIMILAR_GAP = 1;

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

// Dificuldade que marcaste ao criar a task vs a nota que tiveste.
export default function DifficultyVsGradeCard({ tasks, scale }: DifficultyVsGradeCardProps) {
  const { t } = useI18n();
  const enumLabel = useEnumLabel();
  const data = useMemo(() => computeDifficultyVsGrade(tasks), [tasks]);
  if (data.gradedCount < MIN_GRADED_TO_SHOW) return null;

  const max = scaleMax(scale);
  const gap = data.hardMinusEasy;
  let headline = t('difficultyVsGrade.needBoth');
  if (gap !== null) {
    headline =
      Math.abs(gap) < SIMILAR_GAP
        ? t('difficultyVsGrade.similar')
        : t(gap < 0 ? 'difficultyVsGrade.hardLower' : 'difficultyVsGrade.hardHigher', { gap: Math.abs(gap) });
  }

  return (
    <DashboardCard fillBody>
      <CardHeading className="mb-3">
        <ChartPieIcon className="shrink-0" />
        {t('widget.difficultyVsGrade')}
      </CardHeading>
      <CardBody>
        <p className="mb-3 text-xs text-neutral-400">{headline}</p>
        <ul className="space-y-2">
          {data.buckets
            .filter((b) => b.count > 0)
            .map((b) => (
              <li key={b.difficulty} className="text-sm">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-x-2">
                  <span className="text-neutral-300">{enumLabel(b.difficulty)}</span>
                  <span className="flex gap-2 text-xs text-neutral-400">
                    <span className="font-semibold text-white">{b.averageGrade}</span>
                    {b.averageVsTarget !== null && (
                      <span>{t('difficultyVsGrade.vsTarget', { diff: signed(b.averageVsTarget) })}</span>
                    )}
                    <span>{t('difficultyVsGrade.count', { count: b.count })}</span>
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
