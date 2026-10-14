import { AGENDA_TONE_CLASSES, AGENDA_TONE_LABEL_KEY, type AgendaTone } from '../../lib/agendaTone';
import { useI18n } from '../../i18n/useI18n';

const TONES: AgendaTone[] = ['class', 'work', 'event'];

// Legenda das cores da grelha semanal.
export default function AgendaLegend() {
  const { t } = useI18n();
  return (
    <ul className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-400">
      {TONES.map((tone) => (
        <li key={tone} className="flex items-center gap-1.5">
          <span aria-hidden className={`h-2 w-2 rounded-full ${AGENDA_TONE_CLASSES[tone].dot}`} />
          {t(AGENDA_TONE_LABEL_KEY[tone])}
        </li>
      ))}
    </ul>
  );
}
