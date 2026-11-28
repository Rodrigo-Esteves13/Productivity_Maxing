import Button from '../../UI/Button';
import Card from '../../UI/Card';
import ToggleChip from '../../UI/ToggleChip';
import ToggleRow from '../../UI/ToggleRow';
import { useI18n } from '../../../i18n/useI18n';
import type { QuizDetail } from '../../../api/quizzesService';
import type { QuizQuestion } from '../../../lib/quizFormat';
import { stripQuizMarkdown } from '../../../lib/quizMarkdown';
import { pickPractice, PRACTICE_SIZES, type QuizMode } from '../../../lib/quizSession';
import type { QuizHomeState } from './useQuizHome';

interface QuizPracticeCardProps {
  quiz: QuizDetail;
  home: QuizHomeState;
  onStart: (mode: QuizMode, questions: QuizQuestion[]) => void;
}

export default function QuizPracticeCard({ quiz, home, onStart }: QuizPracticeCardProps) {
  const { t } = useI18n();
  return (
    <Card>
      <h2 className="font-semibold text-white">{t('quizzes.mode.practice')}</h2>
      <p className="mt-1 text-sm text-neutral-400">{t('quizzes.home.practiceHelp')}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {quiz.topics.map((topic) => (
          <ToggleChip key={topic} size="sm" pressed={home.topics.includes(topic)} onClick={() => home.toggleTopic(topic)}>
            {stripQuizMarkdown(topic)}
          </ToggleChip>
        ))}
      </div>
      {home.presentKinds.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {home.presentKinds.map((k) => (
            <ToggleChip key={k} size="sm" pressed={home.kinds.includes(k)} onClick={() => home.toggleKind(k)}>
              {t(`quizzes.kind.${k}`)}
            </ToggleChip>
          ))}
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        {PRACTICE_SIZES.map((n) => (
          <ToggleChip key={n} size="sm" pressed={home.practiceSize === n} onClick={() => home.setPracticeSize(n)}>
            {n}
          </ToggleChip>
        ))}
      </div>
      {home.hasGenerators && (
        <div className="mt-3">
          <ToggleRow
            variant="inline"
            label={t('quizzes.calc.mix')}
            description={t('quizzes.calc.mixHelp')}
            checked={home.mixGenerated}
            onChange={home.setMixGenerated}
          />
        </div>
      )}
      <Button
        size="sm"
        className="mt-4"
        disabled={home.practicePool === 0}
        onClick={() => onStart(
      'practice',
      home.withMix(home.practiceSize, (n) => pickPractice(home.poolQuiz, home.topics, home.kinds, n)),
    )}
      >
        {t('quizzes.home.startPractice', { count: Math.min(home.practiceSize, home.practicePool) })}
      </Button>
    </Card>
  );
}
