import Input from '../../UI/Input';
import { useI18n } from '../../../i18n/useI18n';
import { lisbonTodayKey, toDateKey } from '../../../lib/dateKey';

const DEFAULT_LEAD_DAYS = 2;

// Sugestao ao ligar: entregar 2 dias antes, mas nunca num dia ja passado
// (nem depois da apresentacao, se ela for hoje ou ja tiver passado).
function suggestedHandIn(presentationDay: string): string {
  if (!presentationDay) return '';
  const lead = new Date(`${presentationDay}T00:00:00.000Z`);
  lead.setUTCDate(lead.getUTCDate() - DEFAULT_LEAD_DAYS);
  const today = lisbonTodayKey();
  const suggestion = toDateKey(lead);
  if (suggestion >= today) return suggestion;
  return today <= presentationDay ? today : presentationDay;
}

interface SubmissionDateFieldProps {
  idPrefix: string;
  /** "YYYY-MM-DD" ou "" (uma so fase). */
  submissionDate: string;
  /** Dia da apresentacao (o `date` da task): a entrega nunca e depois. */
  presentationDate: string;
  onChange: (value: string) => void;
}

// Trabalho em duas fases: entregar num dia e apresentar noutro (o `date`).
// A entrega tem o seu lembrete na vespera e, ao concluir, pergunta-se se
// cada fase foi a tempo.
export default function SubmissionDateField({
  idPrefix,
  submissionDate,
  presentationDate,
  onChange,
}: SubmissionDateFieldProps) {
  const { t } = useI18n();
  const isTwoPhase = submissionDate !== '';
  const presentationDay = presentationDate.slice(0, 10);

  return (
    <div className="rounded-lg border border-neutral-800 p-3">
      <label className="flex cursor-pointer select-none items-start gap-2 text-sm text-neutral-300">
        <input
          type="checkbox"
          checked={isTwoPhase}
          onChange={(e) => onChange(e.target.checked ? suggestedHandIn(presentationDay) : '')}
          className="mt-0.5 accent-violet-500"
        />
        <span>
          <span className="block">{t('twoPhase.toggle')}</span>
          <span className="block text-xs text-neutral-500">{t('twoPhase.toggleHelp')}</span>
        </span>
      </label>
      {isTwoPhase && (
        <div className="mt-3 max-w-xs">
          <Input
            id={`${idPrefix}-submission-date`}
            label={t('twoPhase.handInDate')}
            type="date"
            value={submissionDate}
            max={presentationDay || undefined}
            onChange={(e) => onChange(e.target.value)}
          />
          <p className="mt-1 text-xs text-neutral-500">{t('twoPhase.handInHelp')}</p>
        </div>
      )}
    </div>
  );
}
