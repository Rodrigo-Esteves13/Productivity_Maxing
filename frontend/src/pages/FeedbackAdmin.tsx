import { useCallback, useState } from 'react';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import ErrorState from '../components/UI/ErrorState';
import EmptyState from '../components/UI/EmptyState';
import CardGridSkeleton from '../components/UI/CardGridSkeleton';
import Modal from '../components/UI/Modal';
import SegmentedControl from '../components/UI/SegmentedControl';
import UserStatusModal from '../components/Users/UserStatusModal';
import FeedbackAdminItem from '../components/Feedback/FeedbackAdminItem';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useFeedbackAdmin, type AccountAction, type FeedbackFilter } from '../hooks/useFeedbackAdmin';
import { FEEDBACK_LIST_LIMIT } from '../api/feedbackService';
import type { FeedbackAuthor } from '../types/models';
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
  const { t } = useI18n();
  useDocumentTitle('Feedback');
  const {
    items,
    visible,
    counts,
    filter,
    setFilter,
    isLoading,
    error,
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

  const filterOptions = FILTERS.map((f) => ({ value: f.value, label: `${t(f.labelKey)} (${counts[f.value]})` }));

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
          <SegmentedControl options={filterOptions} value={filter} onChange={setFilter} size="sm" className="mb-4" />
          {visible.length === 0 ? (
            <EmptyState message={t('feedback.admin.emptyFilter')} />
          ) : (
            <ul className="space-y-3">
              {visible.map((item) => (
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
