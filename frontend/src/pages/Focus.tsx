import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import StudySessionWidget from '../components/Study/StudySessionWidget';
import BestTimesHeatmap from '../components/Study/BestTimesHeatmap';
import TodayPlan from '../components/Study/TodayPlan';
import TodayBlocks from '../components/Study/focus/TodayBlocks';
import DayProgressCard from '../components/Study/focus/DayProgressCard';
import StudyNowHint from '../components/Study/focus/StudyNowHint';
import SessionHistoryCard from '../components/Study/focus/SessionHistoryCard';
import { useStudyPlan } from '../hooks/useStudyPlan';
import useDocumentTitle from '../hooks/useDocumentTitle';

export default function Focus() {
  useDocumentTitle('Focus');
  // Um so pedido do plano, partilhado pelo progresso do dia e pelos blocos.
  const { plan, isLoading, error } = useStudyPlan(1);

  return (
    <PageLayout>
      <PageHeader
        title="Focus"
        description="Track study sessions, follow today's plan, fix your records, and learn your best times to study."
      />

      <div className="mb-6 space-y-3">
        <StudyNowHint />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="flex flex-col gap-6">
          <StudySessionWidget />
          <TodayBlocks plan={plan} isLoading={isLoading} error={error} />
        </div>
        <div className="flex flex-col gap-6">
          <DayProgressCard dailyLimitMinutes={plan?.dailyLimitMinutes ?? null} />
          <TodayPlan />
          <SessionHistoryCard />
        </div>
      </div>

      <div className="mt-6">
        <BestTimesHeatmap />
      </div>
    </PageLayout>
  );
}
