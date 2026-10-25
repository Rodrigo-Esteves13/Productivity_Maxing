import { useEffect, useState } from 'react';
import DashboardCard, { CardHeading } from '../UI/DashboardCard';
import RatingInput from '../UI/RatingInput';
import Textarea from '../UI/Textarea';
import ActionButton from '../UI/ActionButton';
import ErrorState from '../UI/ErrorState';
import LinesSkeleton from '../UI/LinesSkeleton';
import { useFeedback } from '../../context/useFeedback';
import { useI18n } from '../../i18n/useI18n';
import type { useMoodToday } from '../../hooks/useMoodToday';

const MAX_NOTE_LENGTH = 500;

interface MoodCheckInCardProps {
  mood: ReturnType<typeof useMoodToday>;
}

// Check-in diario: humor (obrigatorio), energia e stress (opcionais), nota.
export default function MoodCheckInCard({ mood }: MoodCheckInCardProps) {
  const { t } = useI18n();
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
  }, [mood.log, mood.today]);

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
      <CardHeading className="mb-1">{t('wellbeing.mood.title')}</CardHeading>
      <p className="mb-4 text-sm text-neutral-400">
        {mood.log ? t('wellbeing.mood.loggedToday') : t('wellbeing.mood.prompt')}
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
