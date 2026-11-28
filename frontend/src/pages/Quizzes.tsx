import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import Button from '../components/UI/Button';
import EmptyState from '../components/UI/EmptyState';
import ErrorState from '../components/UI/ErrorState';
import CardGridSkeleton from '../components/UI/CardGridSkeleton';
import SearchField from '../components/UI/SearchField';
import Select from '../components/UI/Select';
import QuizPromptModal from '../components/Quizzes/QuizPromptModal';
import QuizUploadModal from '../components/Quizzes/QuizUploadModal';
import { importQuiz, listQuizzes, type QuizSummary } from '../api/quizzesService';
import { useFeedback } from '../context/useFeedback';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useListSearch } from '../hooks/useListSearch';
import { useI18n } from '../i18n/useI18n';
import type { Quiz } from '../lib/quizFormat';
import { stripQuizMarkdown } from '../lib/quizMarkdown';
import { quizPath } from '../lib/appLinks';
import { DEFAULT_QUIZ_SORT, QUIZ_SORTS, sortQuizzes, type QuizSort } from '../lib/quizList';

const CREATED_DATE_FORMAT: Intl.DateTimeFormatOptions = { dateStyle: 'medium' };

type QuizDialog = null | 'prompt' | 'upload';

// ?open=prompt / ?open=upload (paleta) abre logo o dialogo.
const DIALOG_FROM_PARAM: Record<string, QuizDialog> = { prompt: 'prompt', upload: 'upload' };

export default function Quizzes() {
  const { t, lang } = useI18n();
  useDocumentTitle(t('quizzes.title'));
  const navigate = useNavigate();
  const { notify } = useFeedback();
  const [searchParams] = useSearchParams();
  const [dialog, setDialog] = useState<QuizDialog>(DIALOG_FROM_PARAM[searchParams.get('open') ?? ''] ?? null);
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [sort, setSort] = useState<QuizSort>(DEFAULT_QUIZ_SORT);
  const search = useListSearch(quizzes, (q) => [stripQuizMarkdown(q.title)]);
  const visible = useMemo(() => sortQuizzes(search.filtered, sort), [search.filtered, sort]);

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
      navigate(quizPath(saved.id));
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
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <SearchField value={search.query} onChange={search.setQuery} label={t('ux4study.quizSearch')} />
            <div className="w-full max-w-[12rem]">
              <Select aria-label={t('ux4study.sortLabel')} value={sort} onChange={(e) => setSort(e.target.value as QuizSort)}>
                {QUIZ_SORTS.map((s) => (
                  <option key={s} value={s}>
                    {t(`ux4study.quizSort.${s}`)}
                  </option>
                ))}
              </Select>
            </div>
            {search.isFiltering && (
              <span className="text-xs tabular-nums text-neutral-400" role="status">
                {t('search.count', { shown: visible.length, total: quizzes.length })}
              </span>
            )}
          </div>
          {visible.length === 0 ? (
            <EmptyState message={t('search.noResultsFor', { query: search.query.trim() })} />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((q) => (
                <li key={q.id}>
                  <Link to={quizPath(q.id)} className="press block rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 hover:border-neutral-600">
                    <p className="break-words font-semibold text-white">{stripQuizMarkdown(q.title)}</p>
                    <p className="mt-1 text-sm text-neutral-400">
                      {t('quizzes.card.questions', { count: q.questionCount })}
                      {q.lastScorePct !== null && ` · ${t('quizzes.card.lastScore', { percent: q.lastScorePct })}`}
                    </p>
                    <p className="mt-2 text-xs text-neutral-400">
                      {t('ux4study.createdOn', { date: new Date(q.createdAt).toLocaleDateString(lang, CREATED_DATE_FORMAT) })} · {q.sharedBy ? t('quizzes.shared.by', { name: q.sharedBy.name || t('quizzes.share.unnamed') }) : t('quizzes.aiLabel')}
                      {q.isShared && <span className="ml-2 rounded-md border border-violet-500/50 px-1.5 py-0.5 text-violet-300">{t('quizzes.share.badge')}</span>}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {dialog === 'prompt' && <QuizPromptModal onClose={() => setDialog(null)} />}
      {dialog === 'upload' && <QuizUploadModal onSave={save} onClose={() => setDialog(null)} />}
    </PageLayout>
  );
}
