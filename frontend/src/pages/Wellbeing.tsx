import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import MasonryGrid from '../components/UI/MasonryGrid';
import MoodCheckInCard from '../components/Wellbeing/MoodCheckInCard';
import MedicationsCard from '../components/Wellbeing/MedicationsCard';
import WellbeingInsightsCard from '../components/Wellbeing/WellbeingInsightsCard';
import MedicationHistoryCard from '../components/Wellbeing/MedicationHistoryCard';
import BloodDonationsCard from '../components/Wellbeing/BloodDonationsCard';
import BurnoutAlertCard from '../components/Wellbeing/BurnoutAlertCard';
import FocusEffectCard from '../components/Dashboard/FocusEffectCard';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useMoodToday } from '../hooks/useMoodToday';
import { useMedications } from '../hooks/useMedications';
import { useWellbeingInsights } from '../hooks/useWellbeingInsights';
import { useI18n } from '../i18n/useI18n';

// Bem-estar: check-in diario do humor, medicacao e o que o humor tem a ver
// com o foco (e o foco com as notas, cartao ja existente do Dashboard).
export default function Wellbeing() {
  const { t } = useI18n();
  useDocumentTitle(t('nav.wellbeing'));
  const mood = useMoodToday();
  const meds = useMedications();
  // Recalcula as correlacoes depois de gravar o humor de hoje.
  const { insights, isLoading, error } = useWellbeingInsights(mood.log ? JSON.stringify(mood.log) : null);

  return (
    <PageLayout>
      <PageHeader title={t('nav.wellbeing')} description={t('wellbeing.description')} />
      <BurnoutAlertCard burnout={insights?.burnout} />
      <MasonryGrid stretchLast={false}>
        <MoodCheckInCard mood={mood} />
        <MedicationsCard meds={meds} />
        <MedicationHistoryCard />
        <BloodDonationsCard />
        <WellbeingInsightsCard insights={insights} isLoading={isLoading} error={error} />
        <FocusEffectCard />
      </MasonryGrid>
    </PageLayout>
  );
}
