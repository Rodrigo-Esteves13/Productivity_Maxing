import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import MasonryGrid from '../components/UI/MasonryGrid';
import StudySessionWidget from '../components/Study/StudySessionWidget';
import BestTimesHeatmap from '../components/Study/BestTimesHeatmap';
import TodayBlocks from '../components/Study/focus/TodayBlocks';
import DayProgressCard from '../components/Study/focus/DayProgressCard';
import StudyNowHint from '../components/Study/focus/StudyNowHint';
import SessionHistoryCard from '../components/Study/focus/SessionHistoryCard';
import AmbientSoundCard from '../components/Study/focus/AmbientSoundCard';
import { useStudyPlan } from '../hooks/useStudyPlan';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useI18n } from '../i18n/useI18n';

export default function Focus() {
  const { t } = useI18n();
  useDocumentTitle('Focus');
  // Um so pedido do plano, partilhado pelo progresso do dia e pelos blocos.
  const { plan, isLoading, error } = useStudyPlan(1);

  return (
    <PageLayout>
      <PageHeader
        title={t('ui.focus')}
        description={t('ui.trackStudySessionsFollowToday')}
      />

      <div className="mb-6 space-y-3 empty:hidden">
        <StudyNowHint />
      </div>

      {/* Masonry em vez de duas colunas fixas: o historico de sessoes e muito
          mais alto que o resto e deixava um buraco enorme na coluna da
          esquerda. Cada cartao vai para a coluna mais curta e o ultimo de
          cada coluna estica, por isso acabam ao mesmo nivel. A ordem
          importa: a sessao ativa fica sempre em primeiro lugar. O "Due
          today" vive dentro do cartao Today e o heatmap entra na grelha
          (compacto) em vez de ocupar a largura toda no fim da pagina. */}
      <MasonryGrid>
        <StudySessionWidget />
        <AmbientSoundCard />
        <DayProgressCard dailyLimitMinutes={plan?.dailyLimitMinutes ?? null} />
        <TodayBlocks plan={plan} isLoading={isLoading} error={error} />
        <SessionHistoryCard />
        <BestTimesHeatmap />
      </MasonryGrid>
    </PageLayout>
  );
}
