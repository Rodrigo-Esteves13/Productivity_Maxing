import { useState } from 'react';
import Button from '../UI/Button';
import Card from '../UI/Card';
import ProgressBar from '../UI/ProgressBar';
import QuestionView from './QuestionView';
import { useI18n } from '../../i18n/useI18n';
import { formatElapsed } from '../../lib/formatDuration';
import { stripQuizMarkdown } from '../../lib/quizMarkdown';
import { MS_PER_SECOND, scoreByTopic, type QuizSession, type SessionScore } from '../../lib/quizSession';

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
  // Tempo ativo (pausas longas e site fechado nao contam).
  const durationMs = session.activeMs ?? (session.finishedAt ?? Date.now()) - session.startedAt;
  const wrong = score.results.filter((r) => !r.right).length;
  const isPartial = planned > score.total;
  const showAsk = unsentWrong > 0 && !askDismissed;

  return (
    <div className="space-y-4">
      <Card>
        <p className="text-2xl font-semibold text-white tabular-nums">{t('quizzes.results.score', { correct: score.correct, total: score.total, percent: score.percent })}</p>
        <p className="mt-1 text-sm text-neutral-400">
          {t(`quizzes.mode.${session.mode}`)} · {t('quizzes.results.time', { time: formatElapsed(Math.round(durationMs / MS_PER_SECOND)) })}
        </p>
        {isPartial && <p className="mt-2 text-sm text-amber-300">{t('quizzes.results.partialNote', { answered: score.total, planned })}</p>}
        <ul className="mt-4 space-y-2">
          {scoreByTopic(score).map((ts) => (
            <li key={ts.topic} className="text-sm">
              <div className="flex justify-between text-neutral-300">
                <span>{stripQuizMarkdown(ts.topic)}</span>
                <span className="tabular-nums">{ts.correct}/{ts.total}</span>
              </div>
              <ProgressBar percent={(ts.correct / ts.total) * 100} thickness="sm" label={stripQuizMarkdown(ts.topic)} />
            </li>
          ))}
        </ul>
        {showAsk && (
          <div role="group" aria-label={t('quizzes.results.cardsAsk', { count: unsentWrong })} className="mt-5 rounded-lg border border-violet-500/40 bg-violet-950/20 p-3">
            <p className="text-sm text-neutral-200">{t('quizzes.results.cardsAsk', { count: unsentWrong })}</p>
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
      <ol className="space-y-3">
        {score.results.map(({ question, item }, i) => (
          <li key={item.id}>
            <Card>
              <p className="mb-2 text-xs uppercase tracking-wide text-neutral-500">
                {i + 1}. {stripQuizMarkdown(question.topic)}
              </p>
              <QuestionView question={question} item={item} reveal />
            </Card>
          </li>
        ))}
      </ol>
    </div>
  );
}
