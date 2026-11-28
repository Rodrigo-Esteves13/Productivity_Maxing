import { useCallback, useState } from 'react';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import ErrorState from '../components/UI/ErrorState';
import EmptyState from '../components/UI/EmptyState';
import CardGridSkeleton from '../components/UI/CardGridSkeleton';
import Modal from '../components/UI/Modal';
import SegmentedControl from '../components/UI/SegmentedControl';
import SearchField from '../components/UI/SearchField';
import Select from '../components/UI/Select';
import Pagination from '../components/UI/Pagination';
import UserStatusModal from '../components/Users/UserStatusModal';
import FeedbackAdminItem from '../components/Feedback/FeedbackAdminItem';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { ALL_FILTER, type AllOr } from '../lib/adminLists';
import { languageName } from '../lib/languageName';
import { FEEDBACK_CATEGORIES, FEEDBACK_CATEGORY_KEY } from '../components/Feedback/feedbackStatus';
import { useFeedbackAdmin, type AccountAction } from '../hooks/useFeedbackAdmin';
import { FEEDBACK_SEARCH_MAX_LENGTH, type FeedbackFilter } from '../api/feedbackService';
import type { FeedbackAuthor, FeedbackCategory } from '../types/models';
import { useI18n } from '../i18n/useI18n';

const FILTERS: { value: FeedbackFilter; labelKey: string }[] = [
  { value: 'open', labelKey: 'feedback.admin.filterOpen' },
  { value: 'closed', labelKey: 'feedback.admin.filterClosed' },
  { value: 'all', labelKey: 'feedback.admin.filterAll' },
];

const ACCOUNT_ACTION_TITLE: Record<AccountAction, string> = {
  ban: 'ui.banAccount',
  suspend: 'ui.suspendAccount',
};

// Admin: feedback enviado pelos users, em qualquer língua. A coluna da
// língua diz o que estás a ler (para traduzires se for preciso). Daqui
// responde-se ao autor, recusa-se, resolve-se e modera-se o autor.
export default function FeedbackAdmin() {
  const { t, lang } = useI18n();
  useDocumentTitle(t('nav.admin.feedback'));
  const {
    page,
    filters,
    updateFilters,
    search,
    skip,
    pageSize,
    goToNextPage,
    goToPrevPage,
    isLoading,
    hasError,
    reload,
    toggleResolved,
    reply,
    reject,
    toggleMuted,
    applyAccountAction,
    reactivate,
  } = useFeedbackAdmin();
  const [accountTarget, setAccountTarget] = useState<{ author: FeedbackAuthor; action: AccountAction } | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  const openAccountAction = useCallback((author: FeedbackAuthor, action: AccountAction) => {
    setAccountTarget({ author, action });
  }, []);

  const submitAccountAction = async (payload: { reason: string; until?: string }) => {
    if (!accountTarget) return;
    setIsApplying(true);
    const ok = await applyAccountAction(accountTarget.author, accountTarget.action, payload);
    setIsApplying(false);
    if (ok) setAccountTarget(null);
  };

  const isNarrowed = search !== '' || filters.category !== ALL_FILTER || filters.language !== ALL_FILTER;
  const filterOptions = FILTERS.map((f) => ({
    value: f.value,
    label: `${t(f.labelKey)} (${page?.counts[f.value] ?? 0})`,
  }));

  return (
    <PageLayout>
      <PageHeader title={t('ui.feedback')} description={t('ui.whatUsersSentFromThe')} />
      {isLoading ? (
        <CardGridSkeleton cards={4} />
      ) : hasError || !page ? (
        <ErrorState message={t('ui.errorLoadingFeedback')} onRetry={() => void reload()} />
      ) : !isNarrowed && page.counts.all === 0 ? (
        <EmptyState message={t('ui.noFeedbackYet')} />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <SegmentedControl
              options={filterOptions}
              value={filters.status}
              onChange={(status) => updateFilters({ status })}
              size="sm"
            />
            <SearchField
              value={filters.query}
              onChange={(query) => updateFilters({ query: query.slice(0, FEEDBACK_SEARCH_MAX_LENGTH) })}
              label={t('ux4adm2.feedback.search')}
            />
            <Select
              label={t('ux4adm2.feedback.categoryLabel')}
              value={filters.category}
              onChange={(e) => updateFilters({ category: e.target.value as AllOr<FeedbackCategory> })}
            >
              <option value={ALL_FILTER}>{t('ux4adm2.feedback.allCategories')}</option>
              {FEEDBACK_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(FEEDBACK_CATEGORY_KEY[c])}
                </option>
              ))}
            </Select>
            <Select
              label={t('f7admin.feedback.language')}
              value={filters.language}
              onChange={(e) => updateFilters({ language: e.target.value })}
            >
              <option value={ALL_FILTER}>{t('f7admin.feedback.allLanguages')}</option>
              {page.languages.map((code) => (
                <option key={code} value={code}>
                  {languageName(code, lang)}
                </option>
              ))}
            </Select>
          </div>
          {page.items.length === 0 ? (
            <EmptyState
              message={
                search
                  ? t('search.noResultsFor', { query: search })
                  : isNarrowed
                    ? t('search.noResults')
                    : t('feedback.admin.emptyFilter')
              }
            />
          ) : (
            <>
              <ul className="space-y-3">
                {page.items.map((item) => (
                  <FeedbackAdminItem
                    key={item.id}
                    item={item}
                    onToggleResolved={toggleResolved}
                    onReply={reply}
                    onReject={reject}
                    onToggleMuted={toggleMuted}
                    onAccountAction={openAccountAction}
                    onReactivate={reactivate}
                  />
                ))}
              </ul>
              <Pagination
                total={page.total}
                skip={skip}
                pageSize={pageSize}
                onNextPage={goToNextPage}
                onPrevPage={goToPrevPage}
              />
            </>
          )}
        </>
      )}

      <Modal
        isOpen={accountTarget !== null}
        onClose={() => setAccountTarget(null)}
        title={accountTarget ? t(ACCOUNT_ACTION_TITLE[accountTarget.action]) : ''}
      >
        {accountTarget && (
          <UserStatusModal
            target={accountTarget.author}
            mode={accountTarget.action}
            isSubmitting={isApplying}
            onSubmit={submitAccountAction}
            onCancel={() => setAccountTarget(null)}
          />
        )}
      </Modal>
    </PageLayout>
  );
}
