import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import Button from '../components/UI/Button';
import EmptyState from '../components/UI/EmptyState';
import ErrorState from '../components/UI/ErrorState';
import CardGridSkeleton from '../components/UI/CardGridSkeleton';
import QuizPromptModal from '../components/Quizzes/QuizPromptModal';
import QuizUploadModal from '../components/Quizzes/QuizUploadModal';
import { importQuiz, listQuizzes, type QuizSummary } from '../api/quizzesService';
import { useFeedback } from '../context/useFeedback';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useI18n } from '../i18n/useI18n';
import type { Quiz } from '../lib/quizFormat';
import { stripQuizMarkdown } from '../lib/quizMarkdown';

type QuizDialog = null | 'prompt' | 'upload';

// ?open=prompt / ?open=upload (paleta) abre logo o dialogo.
const DIALOG_FROM_PARAM: Record<string, QuizDialog> = { prompt: 'prompt', upload: 'upload' };

export default function Quizzes() {
  const { t } = useI18n();
  useDocumentTitle(t('quizzes.title'));
  const navigate = useNavigate();
  const { notify } = useFeedback();
  const [searchParams] = useSearchParams();
  const [dialog, setDialog] = useState<QuizDialog>(DIALOG_FROM_PARAM[searchParams.get('open') ?? ''] ?? null);
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setError(false);
    setIsLoading(true);
    listQuizzes()
      .then(setQuizzes)
      .catch(() => setError(true))
      .finally(() => setIsLoading(false));
  }, []);
  useEffect(load, [load]);

  const save = async (quiz: Quiz) => {
    try {
      const saved = await importQuiz(quiz);
      notify(t('quizzes.upload.saved', { count: saved.questionCount }), 'success');
      navigate(`/quizzes/${saved.id}`);
      return true;
    } catch {
      notify(t('quizzes.upload.saveError'), 'error');
      return false;
    }
  };

  return (
    <PageLayout>
      <PageHeader
        title={t('quizzes.title')}
        description={t('quizzes.description')}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => setDialog('prompt')}>
              {t('quizzes.prompt.button')}
            </Button>
            <Button size="sm" onClick={() => setDialog('upload')}>
              {t('quizzes.upload.button')}
            </Button>
          </div>
        }
      />
      <ol className="mb-6 grid gap-3 text-sm text-neutral-300 sm:grid-cols-3">
        {['step1', 'step2', 'step3'].map((step, i) => (
          <li key={step} className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
            <span className="font-mono text-xs text-violet-300">{i + 1}</span>
            <p className="mt-1">{t(`quizzes.how.${step}`)}</p>
          </li>
        ))}
      </ol>
      {isLoading ? (
        <CardGridSkeleton cards={3} />
      ) : error ? (
        <ErrorState message={t('quizzes.loadError')} onRetry={load} />
      ) : quizzes.length === 0 ? (
        <EmptyState message={t('quizzes.empty')} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quizzes.map((q) => (
            <li key={q.id}>
              <Link to={`/quizzes/${q.id}`} className="press block rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 hover:border-neutral-600">
                <p className="break-words font-semibold text-white">{stripQuizMarkdown(q.title)}</p>
                <p className="mt-1 text-sm text-neutral-400">
                  {t('quizzes.card.questions', { count: q.questionCount })}
                  {q.lastScorePct !== null && ` · ${t('quizzes.card.lastScore', { percent: q.lastScorePct })}`}
                </p>
                <p className="mt-2 text-xs text-neutral-500">{t('quizzes.aiLabel')}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {dialog === 'prompt' && <QuizPromptModal onClose={() => setDialog(null)} />}
      {dialog === 'upload' && <QuizUploadModal onSave={save} onClose={() => setDialog(null)} />}
    </PageLayout>
  );
}
