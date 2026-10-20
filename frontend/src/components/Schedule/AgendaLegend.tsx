import LegendItem from '../UI/LegendItem';
import { MONTH_CHIP_LABEL_KEY, MONTH_CHIP_TONE_CLASSES, MONTH_CHIP_TONES } from '../../lib/monthAgenda';
import { useI18n } from '../../i18n/useI18n';

// Legenda das cores do horario (semana e mes): exames, prazos, aulas,
// trabalho e eventos pontuais.
export default function AgendaLegend() {
  const { t } = useI18n();
  return (
    <ul className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-400">
      {MONTH_CHIP_TONES.map((tone) => (
        <li key={tone}>
          <LegendItem dotClassName={MONTH_CHIP_TONE_CLASSES[tone].dot}>{t(MONTH_CHIP_LABEL_KEY[tone])}</LegendItem>
        </li>
      ))}
    </ul>
  );
}
