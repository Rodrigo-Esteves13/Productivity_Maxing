import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import StudySessionWidget from '../components/Study/StudySessionWidget';
import BestTimesHeatmap from '../components/Study/BestTimesHeatmap';
import TodayPlan from '../components/Study/TodayPlan';
import useDocumentTitle from '../hooks/useDocumentTitle';

export default function Focus() {
  useDocumentTitle('Focus');

  return (
    <PageLayout>
      <PageHeader
        title="Focus"
        description="Track study sessions, learn your best times to study, and plan today's time by priority."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StudySessionWidget />
        <TodayPlan />
      </div>

      <div className="mt-6">
        <BestTimesHeatmap />
      </div>
    </PageLayout>
  );
}
