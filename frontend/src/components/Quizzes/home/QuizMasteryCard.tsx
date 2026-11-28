import Card from '../../UI/Card';
import ProgressBar from '../../UI/ProgressBar';
import { useI18n } from '../../../i18n/useI18n';
import { stripQuizMarkdown } from '../../../lib/quizMarkdown';
import type { topicMastery } from '../../../lib/quizSession';

const PERCENT = 100;

// Dominio por topico.
export default function QuizMasteryCard({ mastery }: { mastery: ReturnType<typeof topicMastery> }) {
  const { t } = useI18n();
  return (
    <Card>
      <h2 className="font-semibold text-white">{t('quizzes.home.mastery')}</h2>
      <ul className="mt-3 space-y-3">
        {mastery.map((m) => (
          <li key={m.topic} className="text-sm">
            <div className="flex justify-between text-neutral-300">
              <span>{stripQuizMarkdown(m.topic)}</span>
              <span className="tabular-nums text-neutral-500">{t('quizzes.home.masteryCounts', { right: m.right, wrong: m.wrong, total: m.total })}</span>
            </div>
            <ProgressBar percent={m.total ? (m.right / m.total) * PERCENT : 0} thickness="sm" label={stripQuizMarkdown(m.topic)} />
          </li>
        ))}
      </ul>
    </Card>
  );
}
