import { useMemo } from 'react';
import type { Area, Task } from '../../types/models';
import { computeFailingRisk, type FailingRiskLevel } from '../../utils/failingRisk';
import { usePeriodGradeComponents } from '../../hooks/usePeriodGradeComponents';
import { AlertTriangleIcon } from '../UI/Icons';
import DashboardCard, { CardHeading } from '../UI/DashboardCard';
import ColorDot from '../UI/ColorDot';
import { useI18n } from '../../i18n/useI18n';

interface FailingRiskCardProps {
  tasks: Task[];
  areas: Area[];
  scale: string;
}

// Etiqueta e cor por nivel (tabela em vez de if/else).
const LEVEL_STYLE: Record<FailingRiskLevel, { labelKey: string; className: string }> = {
  impossible: { labelKey: 'failingRisk.level.impossible', className: 'border-red-700 bg-red-900/30 text-red-200' },
  high: { labelKey: 'failingRisk.level.high', className: 'border-red-800 bg-red-900/20 text-red-300' },
  watch: { labelKey: 'failingRisk.level.watch', className: 'border-violet-700 bg-violet-900/30 text-violet-200' },
};

// Aviso antecipado de chumbo: por cadeira, com o que ja foi avaliado, que
// media precisas no resto para chegar a nota minima. Sem cadeiras em risco
// o cartao nao aparece.
export default function FailingRiskCard({ tasks, areas, scale }: FailingRiskCardProps) {
  const { t } = useI18n();
  const components = usePeriodGradeComponents();
  const rows = useMemo(() => computeFailingRisk(tasks, areas, components, scale), [tasks, areas, components, scale]);
  if (rows.length === 0) return null;
  const isSerious = rows.some((r) => r.level !== 'watch');

  return (
    <DashboardCard tone={isSerious ? 'danger' : undefined}>
      <CardHeading tone={isSerious ? 'danger' : undefined} className="mb-2">
        <AlertTriangleIcon className="shrink-0" />
        {t('widget.failingRisk')}
      </CardHeading>
      <p className="mb-3 text-xs text-neutral-400">{t('failingRisk.help')}</p>
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.area.id} className="text-sm">
            <div className="mb-0.5 flex flex-wrap items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2 text-neutral-200">
                <ColorDot size="xs" color={row.area.colorHex} />
                <span className="truncate">{row.area.name}</span>
              </span>
              <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${LEVEL_STYLE[row.level].className}`}>
                {t(LEVEL_STYLE[row.level].labelKey)}
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              {row.neededOnRest === null
                ? t('failingRisk.noWeightLeft', { average: row.currentAverage })
                : t('failingRisk.needed', {
                    average: row.currentAverage,
                    graded: row.gradedWeightPct,
                    needed: row.neededOnRest,
                    remaining: row.remainingWeightPct,
                  })}
            </p>
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
}
