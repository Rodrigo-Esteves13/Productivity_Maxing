import { useMemo, useState } from 'react';
import Button from '../UI/Button';
import Card from '../UI/Card';
import EmptyState from '../UI/EmptyState';
import ProgressBar from '../UI/ProgressBar';
import ProgressRing from '../UI/ProgressRing';
import SegmentedControl from '../UI/SegmentedControl';
import QuestionView from './QuestionView';
import { useI18n } from '../../i18n/useI18n';
import { formatElapsed } from '../../lib/formatDuration';
import { stripQuizMarkdown } from '../../lib/quizMarkdown';
import { MS_PER_SECOND, type QuizSession, type SessionScore } from '../../lib/quizSession';
import {
  attemptTiming,
  BAND_FILL,
  formatMs,
  QUIZ_PASS_PERCENT,
  reviewVerdict,
  scoreBand,
  scoreByKind,
  scoreByTopicWorstFirst,
  type ReviewVerdict,
} from '../../lib/quizInsights';

type ReviewFilter = 'all' | 'wrong' | 'right' | 'flagged';
const REVIEW_FILTERS: ReviewFilter[] = ['all', 'wrong', 'right', 'flagged'];
const RING_SIZE = 120;

const VERDICT_CLASS: Record<ReviewVerdict, string> = {
  right: 'border-violet-400/60 text-violet-300',
  wrong: 'border-red-500/60 text-red-300',
  blank: 'border-neutral-600 text-neutral-400',
};

const RING_CLASS = { good: 'text-violet-500', mid: 'text-amber-500', bad: 'text-red-500' } as const;

interface QuizResultsProps {
  // Numa tentativa parcial a sessao so traz as perguntas respondidas.
  session: QuizSession;
  // Perguntas planeadas (maior que score.total = parcial).
  planned: number;
  score: SessionScore;
  // Erradas que ainda nao foram para as flashcards.
  unsentWrong: number;
  isSendingCards: boolean;
  onSendToFlashcards: () => void;
  onRetryWrong: () => void;
  onHome: () => void;
}

// Nota, tempo, por topico e a revisao de cada pergunta com explicacao e fontes.
export default function QuizResults({ session, planned, score, unsentWrong, isSendingCards, onSendToFlashcards, onRetryWrong, onHome }: QuizResultsProps) {
  const { t } = useI18n();
  const [askDismissed, setAskDismissed] = useState(false);
  const [filter, setFilter] = useState<ReviewFilter>('all');
  // Tempo ativo (pausas longas e site fechado nao contam).
  const durationMs = session.activeMs ?? (session.finishedAt ?? Date.now()) - session.startedAt;
  const wrong = score.results.filter((r) => !r.right).length;
  const isPartial = planned > score.total;
  const showAsk = unsentWrong > 0 && !askDismissed;
  // Erradas que ja estao nas flashcards (de tentativas anteriores) nao voltam a ser oferecidas.
  const alreadySent = wrong - unsentWrong;
  const cardsAsk =
    alreadySent > 0
      ? t('quizzes.results.cardsAskSome', { wrong, already: alreadySent, count: unsentWrong })
      : t('quizzes.results.cardsAsk', { count: unsentWrong });
  const timing = useMemo(() => attemptTiming(score, durationMs), [score, durationMs]);
  const byTopic = useMemo(() => scoreByTopicWorstFirst(score), [score]);
  const byKind = useMemo(() => scoreByKind(score), [score]);
  const passed = score.percent >= QUIZ_PASS_PERCENT;
  // Numero da pergunta na tentativa fica fixo, mesmo com filtro.
  const review = score.results
    .map((r, i) => ({ ...r, n: i + 1, verdict: reviewVerdict(r.question, r.item.response, r.right) }))
    .filter((r) => filter === 'all' || (filter === 'wrong' ? !r.right : filter === 'right' ? r.right : r.item.flagged));

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center gap-5">
          <ProgressRing percent={score.percent} size={RING_SIZE} colorClassName={RING_CLASS[scoreBand(score.percent)]} label={t('quizzes.results.ringLabel')}>
            <span className="text-2xl font-semibold text-white tabular-nums">{score.percent}%</span>
          </ProgressRing>
          <div className="min-w-56 flex-1">
            <p className="text-xs text-neutral-500">{t(`quizzes.mode.${session.mode}`)}</p>
            <p className="text-xl font-semibold text-white">{passed ? t('quizzes.results.passed') : t('quizzes.results.notYet')}</p>
            <p className="mt-1 text-sm text-neutral-300 tabular-nums">{t('quizzes.results.score', { correct: score.correct, total: score.total, percent: score.percent })}</p>
            <p className="mt-1 text-sm text-neutral-400">
              {t('quizzes.results.timing', {
                pass: QUIZ_PASS_PERCENT,
                time: formatElapsed(Math.round(durationMs / MS_PER_SECOND)),
                avg: formatMs(timing.avgMs),
              })}
              {timing.slowest && ` ${t('quizzes.results.slowest', { n: timing.slowest.index + 1, time: formatMs(timing.slowest.ms) })}`}
            </p>
          </div>
        </div>
        {isPartial && <p className="mt-2 text-sm text-amber-300">{t('quizzes.results.partialNote', { answered: score.total, planned })}</p>}
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-white">{t('quizzes.results.byTopic')}</h3>
            <ul className="mt-2 space-y-2">
              {byTopic.map((ts) => {
                const percent = (ts.correct / ts.total) * 100;
                return (
                  <li key={ts.key} className="text-sm">
                    <div className="flex justify-between text-neutral-300">
                      <span>{stripQuizMarkdown(ts.key)}</span>
                      <span className="tabular-nums">{ts.correct}/{ts.total}</span>
                    </div>
                    <ProgressBar percent={percent} thickness="sm" fillClassName={BAND_FILL[scoreBand(percent)]} label={stripQuizMarkdown(ts.key)} />
                  </li>
                );
              })}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">{t('quizzes.results.byKind')}</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {byKind.map((k) => (
                <span key={k.key} className="rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-300">
                  {t(`quizzes.kind.${k.key}`)} <span className="font-semibold tabular-nums text-white">{k.correct}/{k.total}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
        {showAsk && (
          <div role="group" aria-label={cardsAsk} className="mt-5 rounded-lg border border-violet-500/40 bg-violet-950/20 p-3">
            <p className="text-sm text-neutral-200">{cardsAsk}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" disabled={isSendingCards} onClick={onSendToFlashcards}>
                {t('quizzes.results.cardsAdd', { count: unsentWrong })}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setAskDismissed(true)}>
                {t('quizzes.results.cardsNotNow')}
              </Button>
            </div>
          </div>
        )}
        {wrong > 0 && unsentWrong === 0 && <p className="mt-5 text-sm text-neutral-400">{t('quizzes.results.cardsAlready')}</p>}
        <div className="mt-5 flex flex-wrap gap-2">
          <Button size="sm" disabled={wrong === 0} onClick={onRetryWrong}>
            {t('quizzes.results.retryWrong', { count: wrong })}
          </Button>
          {unsentWrong > 0 && askDismissed && (
            <Button variant="secondary" size="sm" disabled={isSendingCards} onClick={onSendToFlashcards}>
              {t('quizzes.results.toFlashcards')}
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={onHome}>
            {t('quizzes.results.home')}
          </Button>
        </div>
      </Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-white">{t('quizzes.results.review')}</h2>
        <SegmentedControl
          size="sm"
          value={filter}
          onChange={setFilter}
          options={REVIEW_FILTERS.map((value) => ({ value, label: t(`quizzes.results.filter.${value}`) }))}
        />
      </div>
      {review.length === 0 ? (
        <EmptyState message={t('quizzes.results.filterEmpty')} />
      ) : (
        <ol className="space-y-3">
          {review.map(({ question, item, n, verdict }) => (
            <li key={item.id}>
              <Card>
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-mono text-neutral-500">#{n}</span>
                  <span className="uppercase tracking-wide text-neutral-500">
                    {stripQuizMarkdown(question.topic)} · {t(`quizzes.kind.${question.kind}`)}
                  </span>
                  <span className={`rounded-md border px-1.5 py-0.5 ${VERDICT_CLASS[verdict]}`}>{t(`quizzes.results.verdict.${verdict}`)}</span>
                  {item.flagged && <span className="rounded-md border border-amber-400/60 px-1.5 py-0.5 text-amber-300">{t('quizzes.results.flagged')}</span>}
                  <span className="flex-1" />
                  <span className="tabular-nums text-neutral-500" title={t('quizzes.results.timeSpent')}>
                    {t('quizzes.results.timeSpentValue', { time: formatMs(item.timeMs) })}
                  </span>
                </div>
                <QuestionView question={question} item={item} reveal />
              </Card>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
