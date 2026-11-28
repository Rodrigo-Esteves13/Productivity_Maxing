import Button from '../../UI/Button';
import Card from '../../UI/Card';
import EmptyState from '../../UI/EmptyState';
import IconButton from '../../UI/IconButton';
import ProgressBar from '../../UI/ProgressBar';
import { TrashIcon } from '../../UI/Icons';
import QuizEvolutionChart from '../QuizEvolutionChart';
import { useI18n } from '../../../i18n/useI18n';
import type { QuizDetail } from '../../../api/quizzesService';
import { formatElapsed } from '../../../lib/formatDuration';
import { BAND_FILL, BAND_TEXT, scoreBand, type evolution } from '../../../lib/quizInsights';
import { MS_PER_SECOND } from '../../../lib/quizSession';

const PERCENT = 100;

// Historico: modo | nota com barra | tempo | data (no telemovel, 2 por linha).
const HISTORY_ROW =
  'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 rounded-xl border border-neutral-800 bg-neutral-900/50 px-4 py-3 text-sm sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_4.5rem_minmax(0,11rem)_auto]';
const DATE_FORMAT: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' };

interface QuizHistoryTabProps {
  quiz: QuizDetail;
  points: ReturnType<typeof evolution>;
  onReset: (kind: 'history' | 'stats' | 'wrong') => void;
  onDeleteAttempt: (attemptId: string) => void;
}

export default function QuizHistoryTab({ quiz, points, onReset, onDeleteAttempt }: QuizHistoryTabProps) {
  const { t, lang } = useI18n();
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" disabled={quiz.attempts.length === 0} onClick={() => onReset('history')}>
          {t('quizzes.reset.history.button')}
        </Button>
        <Button size="sm" variant="secondary" disabled={Object.keys(quiz.stats).length === 0} onClick={() => onReset('stats')}>
          {t('quizzes.reset.stats.button')}
        </Button>
      </div>
      {quiz.attempts.length > 0 && (
        <Card>
          <h2 className="font-semibold text-white">{t('quizzes.stats.evolution', { count: points.length })}</h2>
          <div className="mt-3">
            <QuizEvolutionChart points={points} />
          </div>
        </Card>
      )}
      {quiz.attempts.length === 0 ? (
        <EmptyState message={t('quizzes.history.empty')} />
      ) : (
        <ul className="space-y-2">
          {quiz.attempts.map((a) => {
            const percent = Math.round((a.correct / a.total) * PERCENT);
            const isPartial = (a.planned ?? 0) > a.total;
            return (
              // Grelha com colunas fixas: tudo alinhado de linha para linha.
              <li key={a.id} className={HISTORY_ROW}>
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="font-medium text-neutral-100">{t(`quizzes.mode.${a.mode.toLowerCase()}`)}</span>
                  {isPartial && (
                    <span className="rounded-md border border-amber-400/40 bg-amber-950/30 px-1.5 py-0.5 text-xs text-amber-300">
                      {t('quizzes.history.partial', { answered: a.total, planned: a.planned ?? 0 })}
                    </span>
                  )}
                </div>
                <div className="min-w-0 justify-self-end sm:justify-self-stretch">
                  <p className={`tabular-nums ${BAND_TEXT[scoreBand(percent)]}`}>{t('quizzes.results.score', { correct: a.correct, total: a.total, percent })}</p>
                  <ProgressBar percent={percent} thickness="sm" fillClassName={BAND_FILL[scoreBand(percent)]} label={t('quizzes.history.scoreBar', { percent })} className="mt-1 hidden sm:block" />
                </div>
                <span className="tabular-nums text-neutral-400 sm:text-right">{formatElapsed(Math.round(a.durationMs / MS_PER_SECOND))}</span>
                <span className="justify-self-end tabular-nums text-neutral-400">{new Date(a.finishedAt).toLocaleString(lang, DATE_FORMAT)}</span>
                <IconButton
                  label={t('ux4global.attempt.delete', { date: new Date(a.finishedAt).toLocaleString(lang, DATE_FORMAT) })}
                  tone="danger"
                  onClick={() => onDeleteAttempt(a.id)}
                  className="col-span-2 -my-1 justify-self-end sm:col-span-1"
                >
                  <TrashIcon className="h-4 w-4" />
                </IconButton>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
