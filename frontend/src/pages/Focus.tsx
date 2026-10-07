import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import MasonryGrid from '../components/UI/MasonryGrid';
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

      {/* Masonry em vez de duas colunas fixas: o historico de sessoes e muito
          mais alto que o resto e deixava um buraco enorme na coluna da
          esquerda. Cada cartao vai para a coluna mais curta e o ultimo de
          cada coluna estica, por isso acabam ao mesmo nivel. A ordem
          importa: a sessao ativa fica sempre em primeiro lugar. */}
      <MasonryGrid>
        <StudySessionWidget />
        <DayProgressCard dailyLimitMinutes={plan?.dailyLimitMinutes ?? null} />
        <TodayBlocks plan={plan} isLoading={isLoading} error={error} />
        <TodayPlan />
        <SessionHistoryCard />
      </MasonryGrid>

      <div className="mt-6">
        <BestTimesHeatmap />
      </div>
    </PageLayout>
  );
}
