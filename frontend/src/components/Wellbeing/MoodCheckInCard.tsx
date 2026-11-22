import { useEffect, useState } from 'react';
import DashboardCard, { CardHeading } from '../UI/DashboardCard';
import RatingInput from '../UI/RatingInput';
import Textarea from '../UI/Textarea';
import ActionButton from '../UI/ActionButton';
import ErrorState from '../UI/ErrorState';
import LinesSkeleton from '../UI/LinesSkeleton';
import IconButton from '../UI/IconButton';
import { ChevronLeftIcon, ChevronRightIcon } from '../UI/Icons';
import { MOOD_MAX_PAST_DAYS, type useMoodToday } from '../../hooks/useMoodToday';
import { useFeedback } from '../../context/useFeedback';
import { useI18n } from '../../i18n/useI18n';

const MAX_NOTE_LENGTH = 500;
// Meio-dia UTC do dia (AAAA-MM-DD), para o rotulo mostrar sempre esse dia.
const NOON_UTC_SUFFIX = 'T12:00:00Z';

interface MoodCheckInCardProps {
  mood: ReturnType<typeof useMoodToday>;
}

// Check-in diario: humor (obrigatorio), energia e stress (opcionais), nota.
export default function MoodCheckInCard({ mood }: MoodCheckInCardProps) {
  const { t, lang } = useI18n();
  const { notify } = useFeedback();
  const [value, setValue] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [stress, setStress] = useState<number | null>(null);
  const [note, setNote] = useState('');

  // O registo de hoje chega depois do primeiro render.
  // Num dia novo (mood.today mudou) sem registo, limpa os valores de ontem.
  useEffect(() => {
    setValue(mood.log?.mood ?? null);
    setEnergy(mood.log?.energy ?? null);
    setStress(mood.log?.stress ?? null);
    setNote(mood.log?.note ?? '');
  }, [mood.log, mood.day]);

  const handleSave = async () => {
    if (value === null) return;
    const ok = await mood.save({
      mood: value,
      ...(energy !== null && { energy }),
      ...(stress !== null && { stress }),
      ...(note.trim() && { note: note.trim() }),
    });
    notify(ok ? t('wellbeing.mood.saved') : t('wellbeing.mood.saveError'), ok ? 'success' : 'error');
  };

  return (
    <DashboardCard>
      <CardHeading className="mb-1">
        {t(mood.dayOffset === 0 ? 'wellbeing.mood.title' : 'wellbeing.mood.titlePast')}
      </CardHeading>
      {/* Setas para ir a um dia que passou e registar o humor em falta. */}
      <div className="mb-2 flex items-center gap-1">
        <IconButton
          label={t('wellbeing.meds.prevDay')}
          disabled={mood.dayOffset >= MOOD_MAX_PAST_DAYS}
          onClick={() => mood.setDayOffset(mood.dayOffset + 1)}
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </IconButton>
        <h3 className="min-w-[6rem] text-center text-sm font-medium text-neutral-200" aria-live="polite">
          {mood.dayOffset === 0
            ? t('wellbeing.meds.today')
            : mood.dayOffset === 1
              ? t('wellbeing.meds.yesterday')
              : new Date(`${mood.day}${NOON_UTC_SUFFIX}`).toLocaleDateString(lang, {
                  timeZone: 'UTC',
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                })}
        </h3>
        <IconButton
          label={t('wellbeing.meds.nextDay')}
          disabled={mood.dayOffset === 0}
          onClick={() => mood.setDayOffset(mood.dayOffset - 1)}
        >
          <ChevronRightIcon className="h-4 w-4" />
        </IconButton>
        {mood.dayOffset > 0 && (
          <button
            type="button"
            onClick={() => mood.setDayOffset(0)}
            className="ml-auto text-xs font-medium text-violet-400 hover:text-violet-300"
          >
            {t('wellbeing.meds.backToToday')}
          </button>
        )}
      </div>
      <p className="mb-4 text-sm text-neutral-400">
        {mood.dayOffset === 0
          ? mood.log
            ? t('wellbeing.mood.loggedToday')
            : t('wellbeing.mood.prompt')
          : mood.log
            ? t('wellbeing.mood.loggedPast')
            : t('wellbeing.mood.promptPast')}
      </p>
      {mood.isLoading ? (
        <LinesSkeleton lines={4} />
      ) : mood.error ? (
        <ErrorState message={t('wellbeing.mood.loadError')} />
      ) : (
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-sm font-medium text-neutral-200">{t('wellbeing.mood.mood')}</p>
            <RatingInput value={value} onChange={setValue} hint={t('wellbeing.mood.moodHint')} />
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium text-neutral-200">{t('wellbeing.mood.energy')}</p>
            <RatingInput value={energy} onChange={setEnergy} hint={t('wellbeing.mood.energyHint')} />
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium text-neutral-200">{t('wellbeing.mood.stress')}</p>
            <RatingInput value={stress} onChange={setStress} hint={t('wellbeing.mood.stressHint')} />
          </div>
          <Textarea
            label={t('wellbeing.mood.note')}
            value={note}
            maxLength={MAX_NOTE_LENGTH}
            rows={2}
            placeholder={t('wellbeing.mood.notePlaceholder')}
            onChange={(e) => setNote(e.target.value)}
          />
          <ActionButton type="button" disabled={value === null || mood.isSaving} onClick={() => void handleSave()}>
            {mood.isSaving ? t('common.saving') : t('wellbeing.mood.save')}
          </ActionButton>
        </div>
      )}
    </DashboardCard>
  );
}
