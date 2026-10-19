import { useState } from 'react';
import type { Task } from '../../types/models';
import type { OverdueAnswer } from '../../api/userService';
import { getRemainingTimeLabel } from '../../utils/taskDateStatus';
import { useI18n } from '../../i18n/useI18n';

// Dias que "Remind me later" adia a pergunta (o backend limita a 30).
const SNOOZE_DAYS = 7;
const GRADE_MIN = 0;
const GRADE_MAX = 20;

interface OverdueCheckinModalProps {
  task: Task;
  queueLength: number;
  isAnswering: boolean;
  onAnswer: (answer: OverdueAnswer) => void;
}

// Prompt para tasks já fora de prazo: pergunta se já está feita, para não
// depender de o utilizador se lembrar de marcar cada task manualmente.
// Avaliações (tasks com peso) pedem logo a nota, que é o que de facto se
// quer registar depois de um teste. Deliberadamente não tem X nem fecha com
// Escape/clique no fundo: responder (ou adiar) é a única saída.
export default function OverdueCheckinModal({
  task,
  queueLength,
  isAnswering,
  onAnswer,
}: OverdueCheckinModalProps) {
  const { t } = useI18n();
  const isGraded = (task.weightPercentage ?? 0) > 0;
  const [gradeText, setGradeText] = useState('');

  const parsedGrade = gradeText.trim() === '' ? undefined : Number(gradeText.replace(',', '.'));
  const isGradeInvalid =
    parsedGrade !== undefined &&
    (!Number.isFinite(parsedGrade) || parsedGrade < GRADE_MIN || parsedGrade > GRADE_MAX);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-5 border-b border-neutral-800 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">{t('ui.overdueCheckIn')}</h2>
          {queueLength > 1 && (
            <span className="text-xs font-medium text-neutral-500">
              {t('ui.1Of', { queueLength: queueLength })}</span>
          )}
        </div>

        <div className="p-5">
          <p className="text-sm text-neutral-400 mb-1">{t('ui.thisTaskIsPastIts')}</p>
          <p className="text-white font-semibold mb-2">{task.title}</p>
          <p className="text-sm text-red-400 mb-5">{getRemainingTimeLabel(task)}</p>

          <p className="text-neutral-200 font-medium mb-4">
            {isGraded ? t('ui.didItHappenAddYour') : t('ui.isItActuallyDone')}
          </p>

          {isGraded && (
            <div className="mb-4">
              <label htmlFor="overdue-grade" className="block text-xs text-neutral-500 mb-1">
                {t('ui.gradeToOptional', { gradeMin: GRADE_MIN, gradeMax: GRADE_MAX })}</label>
              <input
                id="overdue-grade"
                type="number"
                inputMode="decimal"
                min={GRADE_MIN}
                max={GRADE_MAX}
                step="0.1"
                value={gradeText}
                onChange={(e) => setGradeText(e.target.value)}
                aria-invalid={isGradeInvalid}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-violet-600/50"
              />
              {isGradeInvalid && (
                <p className="mt-1 text-xs text-red-400">
                  {t('ui.theGradeMustBeBetween', { gradeMin: GRADE_MIN, gradeMax: GRADE_MAX })}</p>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              disabled={isAnswering || isGradeInvalid}
              onClick={() => onAnswer({ isCompleted: true, realGrade: parsedGrade })}
              className="flex-1 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold transition-colors"
            >
              {isGraded ? t('ui.doneSave') : t('ui.yesMarkAsDone')}
            </button>
            <button
              type="button"
              disabled={isAnswering}
              onClick={() => onAnswer({ isCompleted: false })}
              className="flex-1 py-2.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed text-neutral-200 font-semibold transition-colors border border-neutral-700"
            >
              {t('ui.noStillPending')}
            </button>
          </div>

          <button
            type="button"
            disabled={isAnswering}
            onClick={() => onAnswer({ isCompleted: false, snoozeDays: SNOOZE_DAYS })}
            className="mt-3 w-full py-2 text-sm text-neutral-400 hover:text-neutral-200 disabled:opacity-50 transition-colors"
          >
            {t('ui.remindMeInDays', { snoozeDays: SNOOZE_DAYS })}</button>

          <p className="text-xs text-neutral-500 mt-3">
            {t('ui.stillPendingAsksAgainTomorrow')}
          </p>
        </div>
      </div>
    </div>
  );
}
