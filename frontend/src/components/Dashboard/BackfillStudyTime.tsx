import { useState } from 'react';
import ColorDot from '../UI/ColorDot';
import { updateTask } from '../../api/userService';
import { formatDayLabel } from '../../lib/timeFormat';
import type { BackfillCandidate } from '../../types/models';
import { useI18n } from '../../i18n/useI18n';

const MIN_HOURS = 0.25;
const MAX_HOURS = 200;
const MINUTES_PER_HOUR = 60;

interface BackfillRowProps {
  candidate: BackfillCandidate;
  onSaved: () => void;
}

function BackfillRow({ candidate, onSaved }: BackfillRowProps) {
  const { t } = useI18n();
  const [hours, setHours] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    const value = Number(hours.replace(',', '.'));
    if (!Number.isFinite(value) || value < MIN_HOURS || value > MAX_HOURS) {
      setError(t('ui.betweenHours', { min: MIN_HOURS, max: MAX_HOURS }));
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      await updateTask(candidate.taskId, {
        recalledStudyMinutes: Math.round(value * MINUTES_PER_HOUR),
      });
      onSaved();
    } catch {
      setError(t('rateFocus.error'));
      setIsSaving(false);
    }
  };

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <div className="min-w-0 flex-1 basis-40">
        <p className="flex items-center gap-2 text-sm text-neutral-200">
          <ColorDot size="xs" color={candidate.areaColorHex} />
          <span className="truncate">{candidate.title}</span>
        </p>
        <p className="pl-4 text-[11px] text-neutral-500">
          {t('ui.grade', { areaName: candidate.areaName, date: formatDayLabel(candidate.date), grade: candidate.grade, gradeMax: candidate.gradeMax })}</p>
      </div>
      <input
        type="text"
        inputMode="decimal"
        aria-label={t('ui.hoursStudiedFor', { title: candidate.title })}
        placeholder={t('ui.hoursLower')}
        value={hours}
        onChange={(e) => setHours(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void save();
        }}
        className="w-20 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm text-neutral-100 placeholder-neutral-600 focus:border-violet-500 focus:outline-none"
      />
      <button
        type="button"
        onClick={() => void save()}
        disabled={isSaving || hours.trim() === ''}
        className="rounded-md bg-violet-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
      >
        {isSaving ? t('common.saving') : t('ui.save')}
      </button>
      {error && (
        <p role="alert" className="basis-full pl-4 text-xs text-red-400">
          {error}
        </p>
      )}
    </li>
  );
}

interface BackfillStudyTimeProps {
  candidates: BackfillCandidate[];
  onSaved: () => void;
}

// Formulario rapido para escrever, de memoria, quanto estudaste para
// avaliacoes antigas. Um valor aproximado chega: transforma o historico que
// ja tens em dados para as previsoes, em vez de esperar meses de sessoes novas.
export default function BackfillStudyTime({ candidates, onSaved }: BackfillStudyTimeProps) {
  const { t } = useI18n();
  return (
    <div>
      <p className="mb-2 text-xs text-neutral-400">
        {t('ui.aRoughGuessIsFine')}
      </p>
      <ul className="space-y-3">
        {candidates.map((candidate) => (
          <BackfillRow key={candidate.taskId} candidate={candidate} onSaved={onSaved} />
        ))}
      </ul>
    </div>
  );
}
