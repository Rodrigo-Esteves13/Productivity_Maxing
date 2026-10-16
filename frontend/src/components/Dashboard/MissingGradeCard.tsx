import { Link } from 'react-router-dom';
import type { Area } from '../../types/models';
import { useAcademic } from '../../context/useAcademic';
import { useI18n } from '../../i18n/useI18n';
import { useWeightBudgets } from '../../hooks/useWeightBudgets';
import { roundTo } from '../../utils/roundTo';
import { AlertTriangleIcon } from '../UI/Icons';
import DashboardCard, { CardHeading } from '../UI/DashboardCard';
import ColorDot from '../UI/ColorDot';

interface MissingGradeCardProps {
  areas: Area[];
  // Muda quando as tasks mudam, para refazer o pedido.
  refreshKey: number;
}

// "Falta 10%": cadeiras do periodo cujos pesos (tasks + componentes de
// nota) ainda nao somam o maximo, e as que o passam. Fica visivel no topo
// do Dashboard e desaparece sozinho quando tudo esta completo.
export default function MissingGradeCard({ areas, refreshKey }: MissingGradeCardProps) {
  const { t } = useI18n();
  const { activePeriod } = useAcademic();
  const data = useWeightBudgets(activePeriod?.id, refreshKey);
  if (!data) return null;

  const areaById = new Map(areas.map((area) => [area.id, area]));
  const rows = data.budgets
    .map((budget) => ({ ...budget, area: areaById.get(budget.areaId) }))
    .filter((row): row is typeof row & { area: Area } => row.area !== undefined)
    .map((row) => ({ ...row, missing: roundTo(data.max - row.used) }))
    .filter((row) => row.missing !== 0)
    .sort((a, b) => b.missing - a.missing);

  if (rows.length === 0) return null;

  return (
    <DashboardCard tone="warning" className="mb-6">
      <CardHeading tone="warning" className="mb-2">
        <AlertTriangleIcon className="shrink-0" />
        {t('missingGrade.title')}
      </CardHeading>
      <p className="text-sm text-neutral-300 mb-3">{t('missingGrade.subtitle')}</p>
      <ul className="space-y-1.5 mb-3">
        {rows.map(({ area, used, missing }) => (
          <li key={area.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2 text-neutral-200">
              <ColorDot size="xs" color={area.colorHex} />
              <span className="truncate">{area.name}</span>
            </span>
            <span className={`shrink-0 font-medium ${missing < 0 ? 'text-red-400' : 'text-amber-400'}`}>
              {missing < 0
                ? t('missingGrade.over', { over: roundTo(-missing) })
                : t('missingGrade.missing', { missing, used: roundTo(used) })}
            </span>
          </li>
        ))}
      </ul>
      <Link to="/areas" className="text-xs text-violet-400 hover:text-violet-300 underline decoration-dotted">
        {t('missingGrade.action')}
      </Link>
    </DashboardCard>
  );
}
