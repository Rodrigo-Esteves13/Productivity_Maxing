import { useStudyPlan } from '../../hooks/useStudyPlan';
import { requestCalendarSyncReview } from '../../lib/calendarSyncEvents';
import LinesSkeleton from '../UI/LinesSkeleton';
import ErrorState from '../UI/ErrorState';
import EmptyState from '../UI/EmptyState';
import CapacityBanner from './plan/CapacityBanner';
import DailyLimitControl from './plan/DailyLimitControl';
import PlanTaskList from './plan/PlanTaskList';
import PlanDayList from './plan/PlanDayList';
import { useI18n } from '../../i18n/useI18n';
import Card from '../UI/Card';

const PLAN_WINDOW_DAYS = 7;

export default function StudyPlanCard() {
  const { t } = useI18n();
  const { plan, isLoading, error, refetch, setDailyLimit } = useStudyPlan(PLAN_WINDOW_DAYS);

  // Mudar uma estimativa ou o limite diário muda os blocos de estudo, e
  // por isso o que o Google Calendar devia mostrar.
  const handleEstimateSaved = () => {
    void refetch();
    requestCalendarSyncReview();
  };
  const handleLimitChange = async (minutes: number) => {
    await setDailyLimit(minutes);
    requestCalendarSyncReview();
  };

  return (
    <Card>
      <h2 className="text-lg font-semibold text-white mb-1">{t('ui.suggestedStudyPlan')}</h2>
      <p className="text-sm text-neutral-400 mb-4">
        {t('ui.nextDaysFittedAroundClasses', { planWindowDays: PLAN_WINDOW_DAYS })}</p>

      {isLoading && <LinesSkeleton lines={4} />}
      {!isLoading && error && <ErrorState message={error} />}

      {!isLoading && !error && plan && (
        <>
          <CapacityBanner plan={plan} />
          <DailyLimitControl
            key={plan.dailyLimitMinutes}
            value={plan.dailyLimitMinutes}
            onCommit={handleLimitChange}
          />
          <PlanTaskList
            tasks={plan.tasks}
            calibrationFactor={plan.summary.calibrationFactor}
            onEstimateSaved={handleEstimateSaved}
          />
          {plan.suggestions.length > 0 ? (
            <PlanDayList
              suggestions={plan.suggestions}
              days={plan.days}
              dailyLimitMinutes={plan.dailyLimitMinutes}
            />
          ) : (
            <EmptyState variant="inline" message={t('ui.noStudyBlocksToSuggest')} />
          )}
        </>
      )}
    </Card>
  );
}
