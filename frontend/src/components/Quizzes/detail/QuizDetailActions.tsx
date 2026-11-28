import Button from '../../UI/Button';
import { useI18n } from '../../../i18n/useI18n';
import type { QuizDetail } from '../../../api/quizzesService';

interface QuizDetailActionsProps {
  quiz: QuizDetail;
  onShare: () => void;
  onRename: () => void;
  onDelete: () => void;
}

export default function QuizDetailActions({ quiz, onShare, onRename, onDelete }: QuizDetailActionsProps) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap gap-2">
      {/* So o autor partilha; uma copia recebida nao volta a sair. */}
      {!quiz.sharedBy && (
        <Button variant="secondary" size="sm" onClick={onShare}>
          {quiz.isShared ? t('quizzes.share.buttonActive') : t('quizzes.share.button')}
        </Button>
      )}
      <Button variant="secondary" size="sm" onClick={onRename}>
        {t('quickWins.quizRename')}
      </Button>
      <Button variant="secondary" size="sm" onClick={onDelete}>
        {t('quizzes.delete')}
      </Button>
    </div>
  );
}
