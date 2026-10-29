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
import OnThisPage, { SectionAnchor } from '../components/Layout/OnThisPage';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useMoodToday } from '../hooks/useMoodToday';
import { useMedications } from '../hooks/useMedications';
import { useWellbeingInsights } from '../hooks/useWellbeingInsights';
import { useI18n } from '../i18n/useI18n';

// Bem-estar: check-in diario do humor, medicacao e o que o humor tem a ver
// com o foco (e o foco com as notas, cartao ja existente do Dashboard).
// O "Nesta pagina" leva direto a medicacao, sem descer o humor no telemovel.
const SECTIONS = [
  { id: 'mood', labelKey: 'wellbeing.mood.title' },
  { id: 'medication', labelKey: 'wellbeing.meds.title' },
  { id: 'medication-history', labelKey: 'wellbeing.history.title' },
  { id: 'blood', labelKey: 'wellbeing.blood.title' },
  { id: 'insights', labelKey: 'wellbeing.insights.title' },
  { id: 'focus-grades', labelKey: 'focusEffect.title' },
];

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
      <OnThisPage className="mb-4" items={SECTIONS.map((section) => ({ id: section.id, label: t(section.labelKey) }))} />
      <BurnoutAlertCard burnout={insights?.burnout} />
      <MasonryGrid stretchLast={false}>
        <SectionAnchor id="mood"><MoodCheckInCard mood={mood} /></SectionAnchor>
        <SectionAnchor id="medication"><MedicationsCard meds={meds} /></SectionAnchor>
        <SectionAnchor id="medication-history"><MedicationHistoryCard /></SectionAnchor>
        <SectionAnchor id="blood"><BloodDonationsCard /></SectionAnchor>
        <SectionAnchor id="insights"><WellbeingInsightsCard insights={insights} isLoading={isLoading} error={error} /></SectionAnchor>
        <SectionAnchor id="focus-grades"><FocusEffectCard /></SectionAnchor>
      </MasonryGrid>
    </PageLayout>
  );
}
