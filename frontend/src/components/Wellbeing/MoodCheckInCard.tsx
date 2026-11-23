import { useState } from 'react';
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

// Campos do formulario de um dia; o rascunho guarda-se por dia (U-B13).
interface MoodForm {
  value: number | null;
  energy: number | null;
  stress: number | null;
  note: string;
}

interface MoodCheckInCardProps {
  mood: ReturnType<typeof useMoodToday>;
}

// Check-in diario: humor (obrigatorio), energia e stress (opcionais), nota.
export default function MoodCheckInCard({ mood }: MoodCheckInCardProps) {
  const { t, lang } = useI18n();
  const { notify, confirm } = useFeedback();
  // Rascunhos por dia: trocar de dia com as setas nao descarta o que foi
  // escrito. Sem rascunho, o formulario mostra o registo gravado desse dia.
  const [drafts, setDrafts] = useState<Record<string, MoodForm>>({});
  const saved: MoodForm = {
    value: mood.log?.mood ?? null,
    energy: mood.log?.energy ?? null,
    stress: mood.log?.stress ?? null,
    note: mood.log?.note ?? '',
  };
  const form = drafts[mood.day] ?? saved;
  const hasDraft = mood.day in drafts;
  const { value, energy, stress, note } = form;
  const patch = (changes: Partial<MoodForm>) => setDrafts((prev) => ({ ...prev, [mood.day]: { ...form, ...changes } }));
  const dropDraft = (day: string) =>
    setDrafts((prev) => Object.fromEntries(Object.entries(prev).filter(([key]) => key !== day)));

  const handleSave = async () => {
    if (value === null) return;
    const day = mood.day;
    const ok = await mood.save({
      mood: value,
      ...(energy !== null && { energy }),
      ...(stress !== null && { stress }),
      ...(note.trim() && { note: note.trim() }),
    });
    if (ok) dropDraft(day);
    notify(ok ? t('wellbeing.mood.saved') : t('wellbeing.mood.saveError'), ok ? 'success' : 'error');
  };

  const handleClear = async () => {
    const confirmed = await confirm({
      title: t('ux4well.mood.clearTitle'),
      message: t('ux4well.mood.clearMessage'),
      confirmLabel: t('quickWins.moodClear'),
      tone: 'danger',
    });
    if (!confirmed) return;
    const day = mood.day;
    const ok = await mood.clear();
    if (ok) dropDraft(day);
    notify(ok ? t('quickWins.moodCleared') : t('quickWins.moodClearError'), ok ? 'success' : 'error');
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
        <ErrorState message={t('wellbeing.mood.loadError')} onRetry={mood.reload} />
      ) : (
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-sm font-medium text-neutral-200">{t('wellbeing.mood.mood')}</p>
            <RatingInput value={value} onChange={(next) => patch({ value: next })} hint={t('wellbeing.mood.moodHint')} />
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium text-neutral-200">{t('wellbeing.mood.energy')}</p>
            <RatingInput value={energy} onChange={(next) => patch({ energy: next })} hint={t('wellbeing.mood.energyHint')} />
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium text-neutral-200">{t('wellbeing.mood.stress')}</p>
            <RatingInput value={stress} onChange={(next) => patch({ stress: next })} hint={t('wellbeing.mood.stressHint')} />
          </div>
          <Textarea
            label={t('wellbeing.mood.note')}
            value={note}
            maxLength={MAX_NOTE_LENGTH}
            rows={2}
            placeholder={t('wellbeing.mood.notePlaceholder')}
            onChange={(e) => patch({ note: e.target.value })}
          />
          <div className="flex flex-wrap items-center gap-3">
            <ActionButton type="button" disabled={value === null || mood.isSaving} onClick={() => void handleSave()}>
              {mood.isSaving ? t('common.saving') : t('wellbeing.mood.save')}
            </ActionButton>
            {hasDraft && (
              <span className="text-xs text-amber-300" role="status">
                {t('ux4well.mood.draft')}
              </span>
            )}
            {mood.log && (
              <button
                type="button"
                disabled={mood.isSaving}
                onClick={() => void handleClear()}
                className="min-h-10 text-sm font-medium text-neutral-400 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t('quickWins.moodClear')}
              </button>
            )}
          </div>
        </div>
      )}
    </DashboardCard>
  );
}
