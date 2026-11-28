import Button from '../../UI/Button';
import Card from '../../UI/Card';
import { useI18n } from '../../../i18n/useI18n';
import type { QuizQuestion } from '../../../lib/quizFormat';
import type { QuizMode } from '../../../lib/quizSession';

interface QuizWrongCardProps {
  wrong: QuizQuestion[];
  onStart: (mode: QuizMode, questions: QuizQuestion[]) => void;
  onSeeWrong: () => void;
}

export default function QuizWrongCard({ wrong, onStart, onSeeWrong }: QuizWrongCardProps) {
  const { t } = useI18n();
  return (
    <Card>
      <h2 className="font-semibold text-white">{t('quizzes.mode.wrong')}</h2>
      <p className="mt-1 text-sm text-neutral-400">{t('quizzes.home.wrongHelp', { count: wrong.length })}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" disabled={wrong.length === 0} onClick={() => onStart('wrong', wrong)}>
          {t('quizzes.home.startWrong')}
        </Button>
        <Button size="sm" variant="secondary" disabled={wrong.length === 0} onClick={onSeeWrong}>
          {t('quizzes.home.seeWrong')}
        </Button>
      </div>
    </Card>
  );
}
