import Button from '../../UI/Button';
import Card from '../../UI/Card';
import ToggleChip from '../../UI/ToggleChip';
import ToggleRow from '../../UI/ToggleRow';
import { useI18n } from '../../../i18n/useI18n';
import type { QuizDetail } from '../../../api/quizzesService';
import type { QuizQuestion } from '../../../lib/quizFormat';
import { pickExam, type QuizMode } from '../../../lib/quizSession';
import type { QuizHomeState } from './useQuizHome';

const SECONDS_PER_MINUTE = 60;

interface QuizExamCardProps {
  quiz: QuizDetail;
  home: QuizHomeState;
  // Perguntas do ultimo exame: o proximo evita repeti-las.
  lastExamIds: string[];
  onStart: (mode: QuizMode, questions: QuizQuestion[]) => void;
}

export default function QuizExamCard({ quiz, home, lastExamIds, onStart }: QuizExamCardProps) {
  const { t } = useI18n();
  return (
    <Card>
      <h2 className="font-semibold text-white">{t('quizzes.mode.exam')}</h2>
      <p className="mt-1 text-sm text-neutral-400">{t('quizzes.home.examHelp', { seconds: quiz.secondsPerQuestion })}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {[...home.examSizes, home.poolSize].filter((n) => n > 0).map((n) => (
          <ToggleChip key={n} size="sm" pressed={home.examCount === n} onClick={() => home.setExamSize(n)}>
            {t('quizzes.home.examSize', { count: n, minutes: Math.ceil((n * quiz.secondsPerQuestion) / SECONDS_PER_MINUTE) })}
          </ToggleChip>
        ))}
      </div>
      <div className="mt-3">
        <ToggleRow
          variant="inline"
          label={t('quizzes.home.weakFirst')}
          description={t('quizzes.home.weakFirstHelp')}
          checked={home.weakFirst}
          onChange={home.setWeakFirst}
        />
      </div>
      <Button
        size="sm"
        className="mt-4"
        onClick={() =>
          onStart(
      'exam',
      home.withMix(home.examCount, (n) =>
        pickExam(home.poolQuiz, n, Math.random, { weak: home.weakFirst, stats: quiz.stats, avoid: lastExamIds }),
      ),
    )
        }
      >
        {t('quizzes.home.startExam')}
      </Button>
    </Card>
  );
}
