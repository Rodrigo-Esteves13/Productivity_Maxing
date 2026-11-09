import { useMemo } from 'react';
import type { Area, Task } from '../../types/models';
import {
  computeStatusSummaryFacts,
  pickStatusSummaryClauses,
  type StatusSummaryClauseKey,
  type StatusSummaryFacts,
} from '../../lib/statusSummary';
import { CalendarIcon } from '../UI/Icons';
import DashboardCard, { CardBody, CardHeading } from '../UI/DashboardCard';
import { useI18n } from '../../i18n/useI18n';

interface StatusSummaryCardProps {
  tasks: Task[];
  areas: Area[];
}

const DAYS_TODAY = 0;
const DAYS_TOMORROW = 1;
const SINGULAR_COUNT = 1;

// Resumo em linguagem natural do estado atual, so com dados ja carregados.
export default function StatusSummaryCard({ tasks, areas }: StatusSummaryCardProps) {
  const { t } = useI18n();
  const facts = useMemo(() => computeStatusSummaryFacts(tasks, areas, new Date()), [tasks, areas]);
  const clauses = useMemo(() => pickStatusSummaryClauses(facts), [facts]);
  if (clauses.length === 0) return null;

  const sentence = (key: StatusSummaryClauseKey, f: StatusSummaryFacts): string => {
    switch (key) {
      case 'behind':
        return t('statusSummary.behind', {
          area: f.worstArea!.name,
          average: f.worstArea!.average,
          target: f.worstArea!.target,
        });
      case 'best':
        return t('statusSummary.best', {
          area: f.bestArea!.name,
          average: f.bestArea!.average,
          target: f.bestArea!.target,
        });
      case 'overdue':
        return t(
          f.overdueCount === SINGULAR_COUNT ? 'statusSummary.overdueOne' : 'statusSummary.overdueMany',
          { count: f.overdueCount },
        );
      case 'next': {
        const { title, daysLeft } = f.nextDeadline!;
        if (daysLeft === DAYS_TODAY) return t('statusSummary.nextToday', { title });
        if (daysLeft === DAYS_TOMORROW) return t('statusSummary.nextTomorrow', { title });
        return t('statusSummary.nextDays', { title, days: daysLeft });
      }
    }
  };

  return (
    <DashboardCard>
      <CardHeading className="mb-3">
        <CalendarIcon className="shrink-0" />
        {t('statusSummary.title')}
      </CardHeading>
      <CardBody>
        <p className="text-sm text-neutral-200">
          {clauses.map((key) => sentence(key, facts)).join(' ')}
        </p>
      </CardBody>
    </DashboardCard>
  );
}
