import { useEffect, useState } from 'react';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import ErrorState from '../components/UI/ErrorState';
import EmptyState from '../components/UI/EmptyState';
import CardGridSkeleton from '../components/UI/CardGridSkeleton';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { FEEDBACK_LIST_LIMIT, getFeedbackList, setFeedbackResolved } from '../api/feedbackService';
import type { FeedbackItem } from '../types/models';
import { translateNow } from '../i18n/translate';
import { useI18n } from '../i18n/useI18n';

// Admin: feedback enviado pelos users, em qualquer língua. A coluna da
// língua diz o que estás a ler (para traduzires se for preciso).
export default function FeedbackAdmin() {
  const { t } = useI18n();
  useDocumentTitle('Feedback');
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getFeedbackList()
      .then(setItems)
      .catch(() => setError(translateNow('ui.errorLoadingFeedback')))
      .finally(() => setIsLoading(false));
  }, []);

  const toggle = async (item: FeedbackItem) => {
    const next = !item.isResolved;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, isResolved: next } : i)));
    try {
      await setFeedbackResolved(item.id, next);
    } catch {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, isResolved: !next } : i)));
    }
  };

  return (
    <PageLayout>
      <PageHeader title={t('ui.feedback')} description={t('ui.whatUsersSentFromThe')} />
      {isLoading ? (
        <CardGridSkeleton cards={4} />
      ) : error ? (
        <ErrorState message={error} />
      ) : items.length === 0 ? (
        <EmptyState message={t('ui.noFeedbackYet')} />
      ) : (
        <>
        {items.length >= FEEDBACK_LIST_LIMIT && (
          <p className="mb-3 text-sm text-amber-400/80">
            {t('ui.adminListCapped', { count: FEEDBACK_LIST_LIMIT })}
          </p>
        )}
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className={`rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 ${item.isResolved ? 'opacity-60' : ''}`}
            >
              <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400">
                <span className="rounded-full border border-neutral-700 px-2 py-0.5">{item.category}</span>
                <span className="rounded-full border border-neutral-700 px-2 py-0.5 uppercase">{item.language}</span>
                {item.rating !== null && <span>{item.rating}/5</span>}
                {item.page && <span className="font-mono">{item.page}</span>}
                <span>{item.user?.name ?? t('ui.unknown')}</span>
                <span>{new Date(item.createdAt).toLocaleString()}</span>
                <button
                  type="button"
                  onClick={() => void toggle(item)}
                  className="ml-auto text-violet-300 hover:text-violet-200"
                >
                  {item.isResolved ? t('ui.reopen') : t('ui.markResolved')}
                </button>
              </div>
              {/* Texto de utilizador: nunca como HTML. */}
              <p lang={item.language} className="mt-2 whitespace-pre-wrap break-words text-sm text-neutral-100">
                {item.message}
              </p>
            </li>
          ))}
        </ul>
        </>
      )}
    </PageLayout>
  );
}
