import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import ErrorState from '../components/UI/ErrorState';
import EmptyState from '../components/UI/EmptyState';
import LoadingState from '../components/UI/LoadingState';
import SharedWithMeList from '../components/SharedWithMe/SharedWithMeList';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useSharedWithMe } from '../hooks/useSharedWithMe';
import { useI18n } from '../i18n/useI18n';

export default function SharedWithMe() {
  const { t } = useI18n();
  useDocumentTitle(t('nav.sharedWithMe'));
  const { items, isLoading, hasError } = useSharedWithMe();

  return (
    <PageLayout>
      <PageHeader title={t('nav.sharedWithMe')} description={t('sharedWithMe.description')} />
      {isLoading ? (
        <LoadingState message={t('common.loading')} />
      ) : hasError ? (
        <ErrorState message={t('sharedWithMe.error')} />
      ) : items.length === 0 ? (
        <EmptyState message={t('sharedWithMe.empty')} />
      ) : (
        <SharedWithMeList items={items} />
      )}
    </PageLayout>
  );
}
