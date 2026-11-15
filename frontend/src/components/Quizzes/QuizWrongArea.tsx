import { useMemo } from 'react';
import Button from '../UI/Button';
import Card from '../UI/Card';
import EmptyState from '../UI/EmptyState';
import ToggleChip from '../UI/ToggleChip';
import QuestionView from './QuestionView';
import { useI18n } from '../../i18n/useI18n';
import type { QuizDetail } from '../../api/quizzesService';
import type { LastWrongAnswers } from '../../hooks/useQuizSession';
import type { QuizQuestion } from '../../lib/quizFormat';
import { stripQuizMarkdown } from '../../lib/quizMarkdown';
import { answerKeyItem, responseFitsQuestion, statOf, timesWrong, type SessionItem } from '../../lib/quizSession';

interface QuizWrongAreaProps {
  quiz: QuizDetail;
  // Ja ordenadas: mais vezes falhadas primeiro (wrongQuestions).
  wrong: QuizQuestion[];
  lastWrongAnswers: LastWrongAnswers;
  onPractise: (questions: QuizQuestion[]) => void;
  onDismiss: (questionId: string) => void;
  onClearAll: () => void;
}

// Item para a revisao: a ultima resposta errada (se guardada neste dispositivo
// e valida para a pergunta), senao so a chave.
function reviewItem(q: QuizQuestion, answers: LastWrongAnswers): { item: SessionItem; hasAnswer: boolean } {
  const key = answerKeyItem(q);
  const stored = answers.get(q.id);
  return stored && responseFitsQuestion(q, stored) ? { item: { ...key, response: stored }, hasAnswer: true } : { item: key, hasAnswer: false };
}

// Area de erradas: o que falhaste, quantas vezes, a tua ultima resposta e o
// treino por topico, como no quiz de exemplo.
export default function QuizWrongArea({ quiz, wrong, lastWrongAnswers, onPractise, onDismiss, onClearAll }: QuizWrongAreaProps) {
  const { t } = useI18n();
  const byTopic = useMemo(() => {
    const map = new Map<string, QuizQuestion[]>();
    wrong.forEach((q) => map.set(q.topic, [...(map.get(q.topic) ?? []), q]));
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [wrong]);

  if (wrong.length === 0) return <EmptyState message={t('quizzes.wrongArea.empty')} />;

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-neutral-400">{t('quizzes.wrongArea.help')}</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => onPractise(wrong)}>
              {t('quizzes.wrongArea.practiseAll', { count: wrong.length })}
            </Button>
            <Button size="sm" variant="secondary" onClick={onClearAll}>
              {t('quizzes.wrongArea.clear')}
            </Button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2" aria-label={t('quizzes.wrongArea.byTopic')}>
          {byTopic.map(([topic, list]) => (
            <ToggleChip key={topic} size="sm" pressed={false} onClick={() => onPractise(list)}>
              {t('quizzes.wrongArea.topicChip', { topic: stripQuizMarkdown(topic), count: list.length })}
            </ToggleChip>
          ))}
        </div>
      </Card>
      <ul className="space-y-3">
        {wrong.map((q) => {
          const s = statOf(quiz.stats, q.id);
          const { item, hasAnswer } = reviewItem(q, lastWrongAnswers);
          return (
            <li key={q.id}>
              <Card>
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-md border border-red-500/50 px-1.5 py-0.5 text-red-300">{t('quizzes.wrongArea.times', { count: timesWrong(s) })}</span>
                  <span className="uppercase tracking-wide text-neutral-500">
                    {stripQuizMarkdown(q.topic)} · {t(`quizzes.kind.${q.kind}`)}
                  </span>
                  {s?.wrongAt ? <span className="text-neutral-500">{new Date(s.wrongAt).toLocaleDateString()}</span> : null}
                  <span className="flex-1" />
                  <Button size="sm" variant="secondary" onClick={() => onDismiss(q.id)}>
                    {t('quizzes.wrongArea.remove')}
                  </Button>
                </div>
                {!hasAnswer && <p className="mb-2 text-xs text-neutral-500">{t('quizzes.wrongArea.noAnswer')}</p>}
                <QuestionView question={q} item={item} reveal showVerdict={false} />
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
