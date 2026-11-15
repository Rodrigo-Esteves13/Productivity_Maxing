import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import EmptyState from '../UI/EmptyState';
import ErrorState from '../UI/ErrorState';
import LinesSkeleton from '../UI/LinesSkeleton';
import { getMyQuizShares, getQuizzesSharedWithMe, type MyQuizShare, type QuizSharedWithMe } from '../../api/quizzesService';
import { useI18n } from '../../i18n/useI18n';
import { quizPath, sharedQuizPath } from '../../lib/appLinks';
import { stripQuizMarkdown } from '../../lib/quizMarkdown';
import { onSocialChanged } from '../../lib/socialEvents';

// Carrega uma lista de partilhas de quizzes e volta a carregar quando algo
// muda no Social (adicionar uma copia, partilhar com um amigo).
function useQuizShareList<T>(fetcher: () => Promise<T[]>) {
  const [items, setItems] = useState<T[] | null>(null);
  const [hasError, setHasError] = useState(false);
  const load = useCallback(() => {
    fetcher()
      .then((list) => {
        setItems(list);
        setHasError(false);
      })
      .catch(() => setHasError(true));
  }, [fetcher]);
  useEffect(() => {
    load();
    return onSocialChanged(load);
  }, [load]);
  return { items, hasError, reload: load };
}

const ROW = 'press flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-neutral-800 bg-neutral-900/50 px-4 py-3 hover:border-neutral-600';

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      <p className="text-xs text-neutral-400">{description}</p>
    </div>
  );
}

// Social > Partilhado comigo: quizzes que amigos te mandaram.
export function QuizzesSharedWithMe() {
  const { t } = useI18n();
  const { items, hasError, reload } = useQuizShareList<QuizSharedWithMe>(getQuizzesSharedWithMe);
  return (
    <section aria-label={t('quizzes.share.withMeTitle')} className="space-y-3">
      <SectionTitle title={t('quizzes.share.withMeTitle')} description={t('quizzes.share.withMeHelp')} />
      {hasError ? (
        <ErrorState message={t('quizzes.share.loadError')} onRetry={reload} />
      ) : !items ? (
        <LinesSkeleton lines={2} />
      ) : items.length === 0 ? (
        <EmptyState message={t('quizzes.share.withMeEmpty')} />
      ) : (
        <ul className="space-y-2">
          {items.map((q) => (
            <li key={q.token}>
              <Link to={q.addedQuizId ? quizPath(q.addedQuizId) : sharedQuizPath(q.token)} className={ROW}>
                <span className="min-w-0 flex-1 break-words font-medium text-white">{stripQuizMarkdown(q.title)}</span>
                <span className="text-xs text-neutral-400">
                  {t('quizzes.shared.by', { name: q.ownerName || t('quizzes.share.unnamed') })} · {t('quizzes.card.questions', { count: q.questionCount })}
                </span>
                <span className={`text-xs ${q.addedQuizId ? 'text-violet-300' : 'text-amber-300'}`}>
                  {q.addedQuizId ? t('quizzes.share.inYourQuizzes') : t('quizzes.share.notAddedYet')}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Social > As minhas partilhas: quizzes teus com link ativo.
export function MyQuizShares() {
  const { t } = useI18n();
  const { items, hasError, reload } = useQuizShareList<MyQuizShare>(getMyQuizShares);
  return (
    <section aria-label={t('quizzes.share.mineTitle')} className="space-y-3">
      <SectionTitle title={t('quizzes.share.mineTitle')} description={t('quizzes.share.mineHelp')} />
      {hasError ? (
        <ErrorState message={t('quizzes.share.loadError')} onRetry={reload} />
      ) : !items ? (
        <LinesSkeleton lines={2} />
      ) : items.length === 0 ? (
        <EmptyState message={t('quizzes.share.mineEmpty')} />
      ) : (
        <ul className="space-y-2">
          {items.map((q) => (
            <li key={q.quizId}>
              <Link to={`${quizPath(q.quizId)}?share=1`} className={ROW}>
                <span className="min-w-0 flex-1 break-words font-medium text-white">{stripQuizMarkdown(q.title)}</span>
                <span className="text-xs text-neutral-400">
                  {t('quizzes.share.copies', { count: q.copyCount })} · {t('quizzes.share.friendsCount', { count: q.recipientCount })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
