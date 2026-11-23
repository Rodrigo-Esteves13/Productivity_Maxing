import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import Breadcrumbs from '../components/UI/Breadcrumbs';
import Button from '../components/UI/Button';
import Card from '../components/UI/Card';
import ErrorState from '../components/UI/ErrorState';
import LinesSkeleton from '../components/UI/LinesSkeleton';
import { addSharedQuiz, previewSharedQuiz, type QuizSharePreview } from '../api/quizzesService';
import { useFeedback } from '../context/useFeedback';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useI18n } from '../i18n/useI18n';
import { quizPath } from '../lib/appLinks';
import { getApiMessage, getHttpStatus } from '../lib/httpError';
import { stripQuizMarkdown } from '../lib/quizMarkdown';
import { notifySocialChanged } from '../lib/socialEvents';

const HTTP_NOT_FOUND = 404;
const MAX_TOPICS_SHOWN = 12;

// Quiz partilhado: so com sessao iniciada. Mostra o resumo (nunca as
// perguntas) e da uma copia na tua conta, para fazer aqui na app.
export default function SharedQuiz() {
  const { t } = useI18n();
  useDocumentTitle(t('quizzes.shared.title'));
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const { notify } = useFeedback();
  const [preview, setPreview] = useState<QuizSharePreview | null>(null);
  const [error, setError] = useState<'notFound' | 'load' | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const load = useCallback(() => {
    setError(null);
    previewSharedQuiz(token)
      .then(setPreview)
      .catch((e: unknown) => setError(getHttpStatus(e) === HTTP_NOT_FOUND ? 'notFound' : 'load'));
  }, [token]);
  useEffect(load, [load]);

  // O autor recebe o proprio quiz de volta (sem copia nem aviso).
  const add = async () => {
    setIsAdding(true);
    try {
      const { id } = await addSharedQuiz(token);
      if (!preview?.isOwner) {
        notifySocialChanged();
        notify(t('quizzes.shared.addedToast'), 'success');
      }
      navigate(quizPath(id));
    } catch (err) {
      notify(getApiMessage(err, t('quizzes.shared.addError')), 'error');
      setIsAdding(false);
    }
  };

  const existingId = preview?.addedQuizId ?? null;
  const topics = preview?.topics.slice(0, MAX_TOPICS_SHOWN) ?? [];

  return (
    <PageLayout>
      <Breadcrumbs items={[{ label: t('nav.quizzes'), to: '/quizzes' }, { label: t('quizzes.shared.title') }]} />
      <PageHeader title={preview ? stripQuizMarkdown(preview.title) : t('quizzes.shared.title')} description={t('quizzes.shared.description')} />
      {error === 'notFound' ? (
        <ErrorState message={t('quizzes.shared.notFound')} />
      ) : error ? (
        <ErrorState message={t('quizzes.shared.loadError')} onRetry={load} />
      ) : !preview ? (
        <LinesSkeleton lines={4} />
      ) : (
        <Card>
          <p className="text-sm text-neutral-300">
            {t('quizzes.shared.by', { name: preview.ownerName || t('quizzes.share.unnamed') })} · {t('quizzes.card.questions', { count: preview.questionCount })}
            {preview.generatorCount > 0 && ` · ${t('quizzes.shared.generators', { count: preview.generatorCount })}`}
          </p>
          {topics.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={t('quizzes.shared.topics')}>
              {topics.map((topic) => (
                <li key={topic} className="rounded-md border border-neutral-700 px-2 py-0.5 text-xs text-neutral-300">
                  {stripQuizMarkdown(topic)}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs text-neutral-400">{t('quizzes.shared.inAppOnly')}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {preview.isOwner ? (
              <Button size="sm" disabled={isAdding} onClick={() => void add()}>
                {t('quizzes.shared.yours')}
              </Button>
            ) : existingId ? (
              <Button size="sm" onClick={() => navigate(quizPath(existingId))}>
                {t('quizzes.shared.open')}
              </Button>
            ) : (
              <Button size="sm" disabled={isAdding} onClick={() => void add()}>
                {t('quizzes.shared.add')}
              </Button>
            )}
          </div>
        </Card>
      )}
    </PageLayout>
  );
}
