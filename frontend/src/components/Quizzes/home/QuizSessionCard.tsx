import Button from '../../UI/Button';
import Card from '../../UI/Card';
import { useI18n } from '../../../i18n/useI18n';
import { formatRelativeTime } from '../../../lib/money';
import type { QuizSession } from '../../../lib/quizSession';

interface QuizSessionCardProps {
  session: QuizSession;
  answered: number;
  onResume: () => void;
  onFinishNow: () => void;
  onDiscard: () => void;
}

// Tentativa a meio: retomar, terminar ja ou deitar fora.
export default function QuizSessionCard({ session, answered, onResume, onFinishNow, onDiscard }: QuizSessionCardProps) {
  const { t, lang } = useI18n();
  return (
    <Card className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-neutral-200">
        {t('quizzes.home.inProgressDetail', {
          answered,
          total: session.items.length,
          when: formatRelativeTime(new Date(session.lastActiveAt ?? session.startedAt).toISOString(), lang),
        })}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onResume}>
          {t('quizzes.home.resume')}
        </Button>
        <Button variant="secondary" size="sm" onClick={onFinishNow}>
          {t('quizzes.home.finishNow')}
        </Button>
        {/* Destrutivo e sem moldura: pesa menos que "Terminar agora" e nao se confunde com ele. */}
        <Button
          variant="secondary"
          size="sm"
          className="border-transparent! text-red-300! hover:text-red-200!"
          onClick={onDiscard}
        >
          {t('quizzes.home.discard')}
        </Button>
      </div>
    </Card>
  );
}
