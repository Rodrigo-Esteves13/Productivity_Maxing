import DashboardCard, { CardHeading } from '../UI/DashboardCard';
import ErrorState from '../UI/ErrorState';
import LinesSkeleton from '../UI/LinesSkeleton';
import { useI18n } from '../../i18n/useI18n';
import type { CorrelationResult, WellbeingInsights } from '../../types/models';

interface WellbeingInsightsCardProps {
  insights: WellbeingInsights | null;
  isLoading: boolean;
  error: boolean;
}

type InsightKey = 'moodVsFocus' | 'moodVsStudyMinutes' | 'energyVsFocus' | 'stressVsFocus';

const ROWS: { key: InsightKey; labelKey: string }[] = [
  { key: 'moodVsFocus', labelKey: 'wellbeing.insights.moodVsFocus' },
  { key: 'moodVsStudyMinutes', labelKey: 'wellbeing.insights.moodVsStudy' },
  { key: 'energyVsFocus', labelKey: 'wellbeing.insights.energyVsFocus' },
  { key: 'stressVsFocus', labelKey: 'wellbeing.insights.stressVsFocus' },
];

// Texto de cada resultado: tabela em vez de if/switch.
function describe(result: CorrelationResult, t: (key: string, vars?: Record<string, string | number>) => string) {
  if (result.kind === 'not_enough_data') return t('wellbeing.insights.notEnough', { n: result.sampleSize });
  if (result.kind === 'no_variation') return t('wellbeing.insights.noVariation');
  const direction = result.r >= 0 ? 'positive' : 'negative';
  return t(`wellbeing.insights.${result.strength}.${direction}`, { r: result.r, n: result.sampleSize });
}

// Correlacoes humor/energia/stress com o foco e o tempo de estudo.
export default function WellbeingInsightsCard({ insights, isLoading, error }: WellbeingInsightsCardProps) {
  const { t } = useI18n();

  return (
    <DashboardCard>
      <CardHeading className="mb-1">{t('wellbeing.insights.title')}</CardHeading>
      <p className="mb-4 text-xs text-neutral-500">{t('wellbeing.insights.help')}</p>
      {isLoading ? (
        <LinesSkeleton lines={4} />
      ) : error || !insights ? (
        <ErrorState message={t('wellbeing.insights.loadError')} />
      ) : (
        <>
          <p className="mb-3 text-sm text-neutral-300">
            {t('wellbeing.insights.summary', {
              days: insights.loggedDays,
              window: insights.windowDays,
              avg: insights.averageMood ?? '-',
            })}
          </p>
          <dl className="space-y-3">
            {ROWS.map(({ key, labelKey }) => (
              <div key={key}>
                <dt className="text-sm font-medium text-neutral-200">{t(labelKey)}</dt>
                <dd className="text-sm text-neutral-400">{describe(insights[key], t)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-[11px] text-neutral-500">{t('wellbeing.insights.caveat')}</p>
        </>
      )}
    </DashboardCard>
  );
}
