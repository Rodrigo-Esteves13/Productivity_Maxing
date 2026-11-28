import Card from '../../UI/Card';
import EmptyState from '../../UI/EmptyState';
import Input from '../../UI/Input';
import QuestionView, { QuestionPrompt } from '../QuestionView';
import { useI18n } from '../../../i18n/useI18n';
import type { QuizDetail } from '../../../api/quizzesService';
import type { QuizQuestion } from '../../../lib/quizFormat';
import { stripQuizMarkdown } from '../../../lib/quizMarkdown';
import { answerKeyItem, statOf, timesWrong } from '../../../lib/quizSession';

interface QuizBankTabProps {
  quiz: QuizDetail;
  bank: QuizQuestion[];
  search: string;
  onSearchChange: (search: string) => void;
}

export default function QuizBankTab({ quiz, bank, search, onSearchChange }: QuizBankTabProps) {
  const { t } = useI18n();
  return (
    <>
      <Input aria-label={t('quizzes.bank.search')} placeholder={t('quizzes.bank.search')} value={search} onChange={(e) => onSearchChange(e.target.value)} />
      {bank.length === 0 ? (
        <EmptyState message={t('quizzes.bank.empty')} />
      ) : (
        <ul className="space-y-3">
          {bank.map((q) => (
            <li key={q.id}>
              <Card>
                <p className="mb-2 text-xs uppercase tracking-wide text-neutral-500">
                  {stripQuizMarkdown(q.topic)} · {t(`quizzes.kind.${q.kind}`)}
                </p>
                {statOf(quiz.stats, q.id) && (
                  <p className="mb-2 text-xs text-neutral-500">
                    {t('quizzes.bank.statLine', { seen: statOf(quiz.stats, q.id)?.seen ?? 0, right: statOf(quiz.stats, q.id)?.correct ?? 0, wrong: timesWrong(statOf(quiz.stats, q.id)) })}
                  </p>
                )}
                <div className="space-y-3">
                  <QuestionPrompt question={q} />
                </div>
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm text-violet-300">{t('quizzes.bank.reveal')}</summary>
                  <div className="mt-3">
                    <QuestionView question={q} item={answerKeyItem(q)} reveal showVerdict={false} hidePrompt />
                  </div>
                </details>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
