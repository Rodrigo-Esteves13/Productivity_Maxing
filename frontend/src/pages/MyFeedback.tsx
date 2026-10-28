import { useEffect, useState } from 'react';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import ErrorState from '../components/UI/ErrorState';
import EmptyState from '../components/UI/EmptyState';
import CardGridSkeleton from '../components/UI/CardGridSkeleton';
import { feedbackStatusKey, FEEDBACK_STATUS_CLASS } from '../components/Feedback/feedbackStatus';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { getMyFeedback } from '../api/feedbackService';
import type { MyFeedbackItem } from '../types/models';
import { translateNow } from '../i18n/translate';
import { useI18n } from '../i18n/useI18n';

// O feedback que o proprio enviou, com o estado e a resposta da equipa.
// O aviso push de uma resposta abre aqui.
export default function MyFeedback() {
  const { t } = useI18n();
  useDocumentTitle(t('feedback.mine.title'));
  const [items, setItems] = useState<MyFeedbackItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getMyFeedback()
      .then(setItems)
      .catch(() => setError(translateNow('feedback.mine.error')))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <PageLayout>
      <PageHeader title={t('feedback.mine.title')} description={t('feedback.mine.description')} />
      {isLoading ? (
        <CardGridSkeleton cards={3} />
      ) : error ? (
        <ErrorState message={error} />
      ) : items.length === 0 ? (
        <EmptyState message={t('feedback.mine.empty')} />
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const statusKey = feedbackStatusKey(item);
            return (
              <li key={item.id} className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400">
                  <span className={`rounded-full border px-2 py-0.5 ${FEEDBACK_STATUS_CLASS[statusKey]}`}>
                    {t(statusKey)}
                  </span>
                  <span>{new Date(item.createdAt).toLocaleString()}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm text-neutral-100">{item.message}</p>
                {item.adminReply && (
                  <div className="mt-3 rounded-lg border-l-2 border-violet-500 bg-neutral-950/60 px-3 py-2">
                    <p className="text-xs text-neutral-400">
                      {t('feedback.mine.reply')}
                      {item.repliedAt && ` · ${new Date(item.repliedAt).toLocaleString()}`}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-neutral-200">{item.adminReply}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </PageLayout>
  );
}
